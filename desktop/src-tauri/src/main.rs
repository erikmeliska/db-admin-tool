// DB Admin Tool desktop shell: starts the bundled Next.js server with the bundled
// Node runtime on 127.0.0.1 and shows it in a native (WebKit) window.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use hmac::{Hmac, Mac};
use sha2::Sha256;
use tauri::{Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};

/// Fixed port keeps the page origin stable, so localStorage (settings, history,
/// sessions) survives restarts. Falls back to a free port if it's taken.
const PREFERRED_PORT: u16 = 18008;

struct Server(Mutex<Option<Child>>);

fn free_port() -> u16 {
    TcpListener::bind(("127.0.0.1", 0))
        .and_then(|l| l.local_addr())
        .map(|a| a.port())
        .unwrap_or(PREFERRED_PORT)
}

fn random_hex(bytes: usize) -> std::io::Result<String> {
    let mut buf = vec![0u8; bytes];
    std::fs::File::open("/dev/urandom")?.read_exact(&mut buf)?;
    Ok(buf.iter().map(|b| format!("{b:02x}")).collect())
}

/// True once the server on `port` proves it knows the per-launch token by answering
/// HMAC-SHA256(token, nonce) for a fresh nonce. A process squatting on the port can't,
/// and the probe never sends the token itself.
fn is_our_server(port: u16, token: &str) -> bool {
    let Ok(nonce) = random_hex(16) else { return false };
    let Ok(mut stream) = TcpStream::connect(("127.0.0.1", port)) else { return false };
    let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
    let req = format!(
        "GET /api/launch-check?nonce={nonce} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nConnection: close\r\n\r\n"
    );
    if stream.write_all(req.as_bytes()).is_err() {
        return false;
    }
    let mut body = String::new();
    let _ = stream.read_to_string(&mut body);
    let Ok(mut mac) = Hmac::<Sha256>::new_from_slice(token.as_bytes()) else { return false };
    mac.update(nonce.as_bytes());
    let expected: String = mac.finalize().into_bytes().iter().map(|b| format!("{b:02x}")).collect();
    body.starts_with("HTTP/1.1 200") && body.contains(&format!("\"proof\":\"{expected}\""))
}

/// GUI apps get a minimal PATH; take the user's login-shell PATH so the AI CLIs
/// (claude, codex, agy) are found.
fn login_path() -> String {
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".into());
    Command::new(shell)
        .args(["-ilc", "printf '\\n__PATH__%s' \"$PATH\""])
        .output()
        .ok()
        .and_then(|o| {
            String::from_utf8_lossy(&o.stdout)
                .rsplit("__PATH__")
                .next()
                .map(|s| s.trim().to_string())
        })
        .filter(|p| !p.is_empty())
        .unwrap_or_else(|| std::env::var("PATH").unwrap_or_default())
}

fn main() {
    let app = tauri::Builder::default()
        .setup(|app| {
            let server_dir = app.path().resource_dir()?.join("server");
            let node: PathBuf = std::env::current_exe()?
                .parent()
                .expect("exe dir")
                .join("node");
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(data_dir.join("sessions"))?;
            let log = std::fs::File::create(data_dir.join("server.log"))?;

            let token = random_hex(32)?;
            let path = login_path();
            let mut started = None;
            // Try the fixed port first; if something else holds it, Node exits with
            // EADDRINUSE and we retry on a free port.
            for port in [PREFERRED_PORT, free_port()] {
                let mut child = Command::new(&node)
                    .arg("server.js")
                    .current_dir(&server_dir)
                    .env("NODE_ENV", "production")
                    .env("PORT", port.to_string())
                    .env("HOSTNAME", "127.0.0.1")
                    .env("NEXT_TELEMETRY_DISABLED", "1")
                    .env("APP_TOKEN", &token)
                    .env("SESSIONS_DIR", data_dir.join("sessions"))
                    .env("PATH", &path)
                    .stdin(Stdio::null())
                    .stdout(log.try_clone()?)
                    .stderr(log.try_clone()?)
                    .spawn()?;
                let deadline = Instant::now() + Duration::from_secs(30);
                let mut ok = false;
                while Instant::now() < deadline {
                    if child.try_wait()?.is_some() {
                        break;
                    }
                    if is_our_server(port, &token) {
                        ok = true;
                        break;
                    }
                    std::thread::sleep(Duration::from_millis(100));
                }
                if ok {
                    started = Some((port, child));
                    break;
                }
                let _ = child.kill();
                let _ = child.wait();
            }
            let Some((port, child)) = started else {
                return Err(format!(
                    "Server did not start, see {}",
                    data_dir.join("server.log").display()
                )
                .into());
            };
            app.manage(Server(Mutex::new(Some(child))));

            let url = format!("http://127.0.0.1:{port}/?launch={token}").parse()?;
            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
                .title("DB Admin Tool")
                .inner_size(1440.0, 900.0)
                .min_inner_size(900.0, 600.0)
                .build()?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building DB Admin Tool");

    app.run(|handle, event| {
        if let RunEvent::Exit = event {
            if let Some(mut child) = handle.state::<Server>().0.lock().unwrap().take() {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    });
}
