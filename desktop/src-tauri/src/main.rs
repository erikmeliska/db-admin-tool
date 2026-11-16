// DB Admin Tool desktop shell: starts the bundled Next.js server with the bundled
// Node runtime on 127.0.0.1 and shows it in a native (WebKit) window.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::net::{TcpListener, TcpStream};
use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};

/// Fixed port keeps the page origin stable, so localStorage (settings, history,
/// sessions) survives restarts. Falls back to a free port if it's taken.
const PREFERRED_PORT: u16 = 18008;

struct Server(Mutex<Option<Child>>);

fn pick_port() -> u16 {
    if TcpListener::bind(("127.0.0.1", PREFERRED_PORT)).is_ok() {
        return PREFERRED_PORT;
    }
    TcpListener::bind(("127.0.0.1", 0))
        .and_then(|l| l.local_addr())
        .map(|a| a.port())
        .unwrap_or(PREFERRED_PORT)
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

fn wait_for_port(port: u16, timeout: Duration) -> bool {
    let start = Instant::now();
    while start.elapsed() < timeout {
        if TcpStream::connect(("127.0.0.1", port)).is_ok() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(100));
    }
    false
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

            let port = pick_port();
            let child = Command::new(node)
                .arg("server.js")
                .current_dir(&server_dir)
                .env("NODE_ENV", "production")
                .env("PORT", port.to_string())
                .env("HOSTNAME", "127.0.0.1")
                .env("NEXT_TELEMETRY_DISABLED", "1")
                .env("SESSIONS_DIR", data_dir.join("sessions"))
                .env("PATH", login_path())
                .stdout(log.try_clone()?)
                .stderr(log)
                .spawn()?;
            app.manage(Server(Mutex::new(Some(child))));

            if !wait_for_port(port, Duration::from_secs(30)) {
                return Err(format!(
                    "Server did not start, see {}",
                    data_dir.join("server.log").display()
                )
                .into());
            }

            let url = format!("http://127.0.0.1:{port}").parse()?;
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
