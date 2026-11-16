"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "./ThemeProvider";
import { 
    Dialog, 
    DialogContent, 
    DialogDescription, 
    DialogHeader, 
    DialogTitle, 
    DialogTrigger 
} from "@/components/ui/dialog";
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select";
import { Settings, Moon, Sun, Monitor, Trash2, Bot, Database } from "lucide-react";
import { getLLMSettings, setLLMSettings, PROVIDER_LABELS } from "@/lib/llm/client-settings";
import type { LLMProvider, LLMSelection } from "@/lib/llm/bridge";

const MODEL_HINTS: Record<LLMProvider, string> = {
    claude: "e.g. sonnet, opus, haiku",
    codex: "model id accepted by `codex -m`",
    antigravity: "e.g. gemini-3.8-flash-medium (see `agy models`)",
};

interface SettingsDialogProps {
    onCleanupClick: () => void;
    getStorageSize: () => number;
}

export function SettingsDialog({ onCleanupClick, getStorageSize }: SettingsDialogProps) {
    const { theme, setTheme } = useTheme();
    const [llm, setLlm] = useState<LLMSelection>({ provider: "claude" });
    const [bridge, setBridge] = useState<{ ok: boolean; providers?: Record<string, boolean>; error?: string } | null>(null);
    const [storageSize, setStorageSize] = useState(0);

    useEffect(() => {
        setLlm(getLLMSettings());
        setStorageSize(getStorageSize());
        fetch("/api/llm")
            .then((r) => r.json())
            .then(setBridge)
            .catch((e) => setBridge({ ok: false, error: String(e) }));
    }, [getStorageSize]);

    const updateLlm = (next: LLMSelection) => {
        setLlm(next);
        setLLMSettings(next);
    };

    const handleCleanup = () => {
        onCleanupClick();
        setStorageSize(getStorageSize());
    };

    const formatStorageSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-9 w-9 p-0"
                    title="Settings"
                >
                    <Settings className="w-4 h-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center space-x-2">
                        <Settings className="w-5 h-5" />
                        <span>Settings</span>
                    </DialogTitle>
                    <DialogDescription>
                        Configure your Database Admin Tool preferences and AI provider.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* AI provider */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center space-x-2 text-lg">
                                <Bot className="w-4 h-4" />
                                <span>AI Provider</span>
                            </CardTitle>
                            <CardDescription>
                                AI features run through your local, logged-in CLI via the host LLM bridge. No API key needed.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="llm-provider">CLI</Label>
                                <Select
                                    value={llm.provider}
                                    onValueChange={(provider) => updateLlm({ provider: provider as LLMProvider, model: undefined })}
                                >
                                    <SelectTrigger id="llm-provider">
                                        <SelectValue placeholder="Select CLI" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(Object.keys(PROVIDER_LABELS) as LLMProvider[]).map((p) => (
                                            <SelectItem key={p} value={p}>
                                                <div className="flex items-center space-x-2">
                                                    <span>{PROVIDER_LABELS[p]}</span>
                                                    {bridge?.providers && !bridge.providers[p] && (
                                                        <Badge variant="outline" className="text-xs">not installed</Badge>
                                                    )}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="llm-model">Model (optional)</Label>
                                <Input
                                    id="llm-model"
                                    placeholder={MODEL_HINTS[llm.provider ?? "claude"]}
                                    value={llm.model ?? ""}
                                    onChange={(e) => updateLlm({ ...llm, model: e.target.value })}
                                />
                                <p className="text-xs text-muted-foreground">Empty = the CLI&apos;s default model.</p>
                            </div>
                            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                                <Badge variant={bridge?.ok ? "secondary" : "destructive"} className="text-xs">
                                    {bridge === null ? "checking…" : bridge.ok ? "bridge online" : "bridge offline"}
                                </Badge>
                                {bridge && !bridge.ok && <span className="text-xs">Start it with ./scripts/local-up.sh</span>}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Appearance Settings */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center space-x-2 text-lg">
                                <Monitor className="w-4 h-4" />
                                <span>Appearance</span>
                            </CardTitle>
                            <CardDescription>
                                Customize the look and feel of the application.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="theme-select">Theme</Label>
                                <Select value={theme} onValueChange={setTheme}>
                                    <SelectTrigger id="theme-select">
                                        <SelectValue placeholder="Select theme" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="light">
                                            <div className="flex items-center space-x-2">
                                                <Sun className="w-4 h-4" />
                                                <span>Light</span>
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="dark">
                                            <div className="flex items-center space-x-2">
                                                <Moon className="w-4 h-4" />
                                                <span>Dark</span>
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="system">
                                            <div className="flex items-center space-x-2">
                                                <Monitor className="w-4 h-4" />
                                                <span>System</span>
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Storage Management */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center space-x-2 text-lg">
                                <Database className="w-4 h-4" />
                                <span>Storage Management</span>
                            </CardTitle>
                            <CardDescription>
                                Manage local storage and session data.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <p className="text-sm font-medium">Current Storage Usage</p>
                                    <p className="text-xs text-muted-foreground">
                                        Local storage used by the application
                                    </p>
                                </div>
                                <Badge variant="outline">
                                    {formatStorageSize(storageSize)}
                                </Badge>
                            </div>
                            
                            <Separator />
                            
                            <div className="space-y-2">
                                <Button
                                    variant="outline"
                                    onClick={handleCleanup}
                                    className="w-full flex items-center space-x-2"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    <span>Clean Up Old Session Data</span>
                                </Button>
                                <p className="text-xs text-muted-foreground">
                                    Remove old session data and query history to free up storage space.
                                    This keeps only the 5 most recent sessions.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* About */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">About</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Version</span>
                                <Badge variant="secondary">v2.2.0</Badge>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Build</span>
                                <span className="font-mono text-xs">Latest</span>
                            </div>
                            <Separator />
                            <p className="text-xs text-muted-foreground">
                                Modern database administration tool with AI-powered query generation.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </DialogContent>
        </Dialog>
    );
} 