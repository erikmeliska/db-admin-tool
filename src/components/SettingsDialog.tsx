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
import { Settings, Moon, Sun, Monitor, Trash2, Key, Database } from "lucide-react";

interface SettingsDialogProps {
    onCleanupClick: () => void;
    getStorageSize: () => number;
}

export function SettingsDialog({ onCleanupClick, getStorageSize }: SettingsDialogProps) {
    const { theme, setTheme } = useTheme();
    const [googleApiKey, setGoogleApiKey] = useState("");
    const [isApiKeyVisible, setIsApiKeyVisible] = useState(false);
    const [storageSize, setStorageSize] = useState(0);

    // Load Google API key from localStorage on mount
    useEffect(() => {
        const savedApiKey = localStorage.getItem("google-api-key");
        if (savedApiKey) {
            setGoogleApiKey(savedApiKey);
        }
        setStorageSize(getStorageSize());
    }, [getStorageSize]);

    const handleApiKeyChange = (value: string) => {
        setGoogleApiKey(value);
        if (value.trim()) {
            localStorage.setItem("google-api-key", value.trim());
        } else {
            localStorage.removeItem("google-api-key");
        }
    };

    const handleCleanup = () => {
        onCleanupClick();
        setStorageSize(getStorageSize());
    };

    const maskApiKey = (key: string) => {
        if (!key || key.length < 8) return key;
        return key.slice(0, 4) + "•".repeat(key.length - 8) + key.slice(-4);
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
                        Configure your Database Admin Tool preferences and API settings.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* API Configuration */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center space-x-2 text-lg">
                                <Key className="w-4 h-4" />
                                <span>API Configuration</span>
                            </CardTitle>
                            <CardDescription>
                                Configure your Google AI API key for AI-powered query generation.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="google-api-key">Google AI API Key</Label>
                                <div className="flex space-x-2">
                                    <Input
                                        id="google-api-key"
                                        type={isApiKeyVisible ? "text" : "password"}
                                        placeholder="Enter your Google AI API key..."
                                        value={googleApiKey}
                                        onChange={(e) => handleApiKeyChange(e.target.value)}
                                        className="flex-1"
                                    />
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setIsApiKeyVisible(!isApiKeyVisible)}
                                        className="px-3"
                                    >
                                        {isApiKeyVisible ? "Hide" : "Show"}
                                    </Button>
                                </div>
                                {googleApiKey && (
                                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                                        <Badge variant="outline" className="text-xs">
                                            Configured
                                        </Badge>
                                        <span>Key: {maskApiKey(googleApiKey)}</span>
                                    </div>
                                )}
                                <p className="text-xs text-muted-foreground">
                                    Get your API key from{" "}
                                    <a 
                                        href="https://ai.google.dev/" 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-primary hover:underline"
                                    >
                                        Google AI Studio
                                    </a>
                                </p>
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