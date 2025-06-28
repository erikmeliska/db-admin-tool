"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ConnectionSession, QueryResult, TableSchema } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SecureConnectionManager } from "@/components/SecureConnectionManager";
import { DatabaseExplorer } from "@/components/DatabaseExplorer";
import { QueryEditor } from "@/components/QueryEditor";
import { LLMQueryGenerator } from "@/components/LLMQueryGenerator";
import { QueryHistory } from "@/components/QueryHistory";
import { SettingsDialog } from "@/components/SettingsDialog";
import {
    Database,
    Settings,
    Code,
    Brain,
    History,
    Menu,
    ChevronLeft,
} from "lucide-react";

// Query tab persistence types
interface QueryTab {
    id: string;
    title: string;
    query: string;
    result?: QueryResult;
    isExecuting?: boolean;
}

export default function Dashboard() {
    const [selectedSession, setSelectedSession] =
        useState<ConnectionSession | null>(null);
    const [activeTab, setActiveTab] = useState("query");
    const [queryToExecute, setQueryToExecute] = useState("");
    const [availableTables, setAvailableTables] = useState<string[]>([]);
    const [tableSchemas, setTableSchemas] = useState<
        Record<string, TableSchema>
    >({});
    const [loadingSchemas, setLoadingSchemas] = useState(false);
    const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
    const [sidebarTab, setSidebarTab] = useState("connections");

    // AI Generator prefilled data
    const [aiPrefilledData, setAiPrefilledData] = useState<{
        prompt?: string;
        tables?: string[];
    }>({});

    // Persistent query tabs state
    const [queryTabs, setQueryTabs] = useState<
        Record<string, { tabs: QueryTab[]; activeTab: string }>
    >({});
    const loadedSessionsRef = useRef<Set<string>>(new Set());

    // Helper functions for tab persistence
    const getTabStorageKey = (sessionId: string) => `query-tabs-${sessionId}`;
    const getActiveTabStorageKey = (sessionId: string) =>
        `active-tab-${sessionId}`;

    // localStorage management utilities
    const getStorageSize = () => {
        let total = 0;
        for (const key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                total += localStorage[key].length + key.length;
            }
        }
        return total;
    };

    const cleanupOldTabData = (currentSessionId?: string) => {
        const keysToRemove: string[] = [];
        const queryTabPrefix = "query-tabs-";
        const activeTabPrefix = "active-tab-";
        const llmStatePrefix = "llm-state-";

        // Find old session data (keep only last 5 sessions + current)
        const sessionIds = new Set<string>();

        for (const key in localStorage) {
            if (key.startsWith(queryTabPrefix)) {
                const sessionId = key.replace(queryTabPrefix, "");
                sessionIds.add(sessionId);
            }
        }

        const sessionIdArray = Array.from(sessionIds);
        const sessionsToKeep = 5;

        if (sessionIdArray.length > sessionsToKeep) {
            const sessionsToRemove = sessionIdArray
                .filter((id) => id !== currentSessionId)
                .slice(0, -sessionsToKeep + 1);

            sessionsToRemove.forEach((sessionId) => {
                keysToRemove.push(`${queryTabPrefix}${sessionId}`);
                keysToRemove.push(`${activeTabPrefix}${sessionId}`);
                keysToRemove.push(`${llmStatePrefix}${sessionId}`);
            });
        }

        // Remove keys
        keysToRemove.forEach((key) => {
            try {
                localStorage.removeItem(key);
            } catch {
                console.warn("Failed to remove localStorage key:", key);
            }
        });

        return keysToRemove.length;
    };

    const safeSaveToStorage = (
        key: string,
        value: string,
        currentSessionId?: string
    ): boolean => {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch {
            console.warn("localStorage quota exceeded, attempting cleanup...");

            // Try cleanup and retry
            const removedItems = cleanupOldTabData(currentSessionId);
            console.log(`Cleaned up ${removedItems} old localStorage items`);

            try {
                localStorage.setItem(key, value);
                return true;
            } catch (retryError) {
                console.error(
                    "Failed to save to localStorage even after cleanup:",
                    retryError
                );

                // Show user-friendly error
                const storageSize = (getStorageSize() / 1024).toFixed(1);
                console.error(
                    `localStorage usage: ${storageSize}KB. Consider clearing browser data for localhost.`
                );

                return false;
            }
        }
    };

    const loadPersistedTabs = useCallback(
        (sessionId: string): { tabs: QueryTab[]; activeTab: string } => {
            try {
                const storedTabs = localStorage.getItem(
                    getTabStorageKey(sessionId)
                );
                const storedActiveTab = localStorage.getItem(
                    getActiveTabStorageKey(sessionId)
                );

                if (storedTabs) {
                    const parsedTabs = JSON.parse(storedTabs);
                    return {
                        tabs: parsedTabs,
                        activeTab: storedActiveTab || parsedTabs[0]?.id || "1",
                    };
                }
            } catch (error) {
                console.error("Failed to load persisted tabs:", error);
            }

            // Return default if no persisted tabs or error
            return {
                tabs: [{ id: "1", title: "Query 1", query: "" }],
                activeTab: "1",
            };
        },
        []
    ); // No dependencies - this function is pure

    const saveTabsToStorage = useCallback(
        (sessionId: string, tabs: QueryTab[], activeTab: string) => {
            // Serialize tabs but limit the size by truncating large results
            const sanitizedTabs = tabs.map((tab) => ({
                ...tab,
                result: tab.result
                    ? {
                          ...tab.result,
                          // Limit result data to prevent localStorage bloat
                          rows: tab.result.rows?.slice(0, 100) || [], // Keep only first 100 rows
                          executionTime: tab.result.executionTime,
                          affectedRows: tab.result.affectedRows,
                      }
                    : undefined,
            }));

            const tabsSuccess = safeSaveToStorage(
                getTabStorageKey(sessionId),
                JSON.stringify(sanitizedTabs),
                sessionId
            );
            const activeTabSuccess = safeSaveToStorage(
                getActiveTabStorageKey(sessionId),
                activeTab,
                sessionId
            );

            if (!tabsSuccess || !activeTabSuccess) {
                console.warn(
                    "Some tab data could not be saved to localStorage due to quota limits"
                );
            }
        },
        []
    ); // No dependencies - this function is pure

    useEffect(() => {
        if (selectedSession) {
            loadTables();

            // Load persisted tabs for this session only if not already loaded
            if (!loadedSessionsRef.current.has(selectedSession.sessionId)) {
                const sessionTabData = loadPersistedTabs(
                    selectedSession.sessionId
                );
                setQueryTabs((prev) => ({
                    ...prev,
                    [selectedSession.sessionId]: sessionTabData,
                }));
                loadedSessionsRef.current.add(selectedSession.sessionId);
            }
        } else {
            setAvailableTables([]);
            setTableSchemas({});
        }
    }, [selectedSession, loadPersistedTabs]);

    const loadTables = async () => {
        if (!selectedSession) return;

        // console.log('Loading tables for session:', selectedSession.sessionId);
        try {
            const response = await fetch("/api/query?action=tables", {
                headers: {
                    Authorization: `Bearer ${selectedSession.sessionId}`,
                },
            });
            // console.log('Tables response status:', response.status);
            const result = await response.json();
            // console.log('Tables response:', result);

            if (result.tables) {
                setAvailableTables(result.tables);
                // Don't load all schemas immediately - only load on demand
            } else if (result.error) {
                console.error("Tables API error:", result.error);
            }
        } catch (error) {
            console.error("Failed to load tables:", error);
        }
    };

    // Load schema for a single table on demand
    const loadTableSchema = async (tableName: string): Promise<TableSchema | null> => {
        if (!selectedSession) return null;

        try {
            const response = await fetch(
                `/api/query?action=schema&table=${tableName}`,
                {
                    headers: {
                        Authorization: `Bearer ${selectedSession.sessionId}`,
                    },
                }
            );
            const result = await response.json();

            if (result.schema) {
                // Update the schemas state with the new schema
                setTableSchemas(prev => ({ ...prev, [tableName]: result.schema }));
                return result.schema;
            } else {
                console.warn(`No schema returned for table ${tableName}`);
                return null;
            }
        } catch (error) {
            console.error(`Failed to load schema for table ${tableName}:`, error);
            return null;
        }
    };

    // Load schemas for multiple tables (used by AI Generator)
    const loadTableSchemas = async (tables: string[]) => {
        if (!selectedSession) return;

        setLoadingSchemas(true);
        try {
            const schemas: Record<string, TableSchema> = {};

            // Load schema for each table
            for (const tableName of tables) {
                try {
                    const response = await fetch(
                        `/api/query?action=schema&table=${tableName}`,
                        {
                            headers: {
                                Authorization: `Bearer ${selectedSession.sessionId}`,
                            },
                        }
                    );
                    const result = await response.json();

                    if (result.schema) {
                        schemas[tableName] = result.schema;
                    } else {
                        console.warn(`No schema returned for table ${tableName}`);
                    }
                } catch (error) {
                    console.error(`Failed to load schema for table ${tableName}:`, error);
                }
            }

            // Update schemas state
            setTableSchemas(prev => ({ ...prev, ...schemas }));
        } catch (error) {
            console.error("Failed to load table schemas:", error);
        } finally {
            setLoadingSchemas(false);
        }
    };

    const handleTableSelect = async (tableName: string, schema?: TableSchema) => {
        // If schema is not provided, load it on demand
        if (!schema) {
            await loadTableSchema(tableName);
        } else {
            // Update schemas if provided
            setTableSchemas((prev) => ({ ...prev, [tableName]: schema }));
        }

        // Generate a simple SELECT query for the selected table with proper quoting
        // Use backticks for MySQL, double quotes for PostgreSQL, square brackets for SQL Server
        const quotedTableName =
            selectedSession?.type === "postgresql"
                ? `"${tableName}"`
                : `\`${tableName}\``;
        setQueryToExecute(`SELECT * FROM ${quotedTableName} LIMIT 10;`);
        // Collapse the sidebar when a table is selected
        setIsSidebarExpanded(false);
    };

    const handleAIPromptSelect = (prompt: string, tables: string[]) => {
        setAiPrefilledData({ prompt, tables });
        setActiveTab("ai");
    };

    // Clear prefilled data when switching away from AI tab
    useEffect(() => {
        if (activeTab !== "ai") {
            setAiPrefilledData({});
        }
    }, [activeTab]);

    const handleQueryExecuted = (query: string, result: QueryResult) => {
        console.log("Query executed:", query, result);
    };

    const handleSidebarTabChange = (tab: string) => {
        setSidebarTab(tab);
        if (tab === "explorer" && !isSidebarExpanded) {
            setIsSidebarExpanded(true);
        }
    };

    // Handle query tab updates
    const handleQueryTabsUpdate = (tabs: QueryTab[], activeTab: string) => {
        if (!selectedSession) return;

        const sessionId = selectedSession.sessionId;
        setQueryTabs((prev) => ({
            ...prev,
            [sessionId]: { tabs, activeTab },
        }));

        // Save to localStorage
        saveTabsToStorage(sessionId, tabs, activeTab);
    };

    // Get current session's tab data
    const getCurrentTabData = () => {
        if (!selectedSession)
            return {
                tabs: [{ id: "1", title: "Query 1", query: "" }],
                activeTab: "1",
            };
        return (
            queryTabs[selectedSession.sessionId] || {
                tabs: [{ id: "1", title: "Query 1", query: "" }],
                activeTab: "1",
            }
        );
    };

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="bg-card border-b border-border px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <Database className="w-8 h-8 text-primary" />
                        <div>
                            <h1 className="text-2xl font-bold text-foreground">
                                Database Admin Tool
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                Modern database management with AI assistance
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center space-x-4">
                        {selectedSession && (
                            <div className="flex items-center space-x-2">
                                <Badge
                                    variant="outline"
                                    className="flex items-center space-x-1"
                                >
                                    <Database className="w-3 h-3" />
                                    <span>{selectedSession.name}</span>
                                </Badge>
                                <Badge variant="secondary">
                                    {selectedSession.type}
                                </Badge>
                            </div>
                        )}
                        <SettingsDialog 
                            onCleanupClick={() => {
                                const removedItems = cleanupOldTabData();
                                const storageSize = (
                                    getStorageSize() / 1024
                                ).toFixed(1);
                                console.log(
                                    `Cleaned up ${removedItems} items. Current storage: ${storageSize}KB`
                                );
                                alert(
                                    `Cleaned up ${removedItems} old sessions. Current storage: ${storageSize}KB`
                                );
                            }}
                            getStorageSize={getStorageSize}
                        />
                    </div>
                </div>
            </header>

            <div className="flex relative">
                {/* Collapsible Sidebar or Icon */}
                {isSidebarExpanded ? (
                    <aside className="w-[700px] flex-shrink-0 bg-card border-r border-border h-[calc(100vh-81px)] overflow-hidden transition-all duration-300 ease-in-out shadow-lg">
                        <div className="h-full flex flex-col">
                            {/* Sidebar Header with Collapse Button */}
                            <div className="flex items-center justify-between p-4 border-b border-border">
                                <h2 className="font-semibold text-foreground">
                                    Database Management
                                </h2>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsSidebarExpanded(false)}
                                    className="h-8 w-8 p-0"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </Button>
                            </div>

                            {/* Sidebar Content */}
                            <div className="flex-1 overflow-hidden">
                                <div className="p-4 h-full">
                                    <Tabs
                                        value={sidebarTab}
                                        onValueChange={handleSidebarTabChange}
                                        className="h-full flex flex-col"
                                    >
                                        <TabsList className="grid w-full grid-cols-2 mb-4">
                                            <TabsTrigger
                                                value="connections"
                                                className="flex items-center space-x-2"
                                            >
                                                <Settings className="w-4 h-4" />
                                                <span>Connections</span>
                                            </TabsTrigger>
                                            <TabsTrigger
                                                value="explorer"
                                                className="flex items-center space-x-2"
                                            >
                                                <Database className="w-4 h-4" />
                                                <span>Explorer</span>
                                            </TabsTrigger>
                                        </TabsList>

                                        <div className="flex-1 overflow-hidden">
                                            <TabsContent
                                                value="connections"
                                                className="h-full overflow-y-auto mt-0"
                                            >
                                                <SecureConnectionManager
                                                    onSessionSelect={
                                                        setSelectedSession
                                                    }
                                                    selectedSession={
                                                        selectedSession
                                                    }
                                                />
                                            </TabsContent>

                                            <TabsContent
                                                value="explorer"
                                                className="h-full overflow-y-auto mt-0"
                                            >
                                                {selectedSession ? (
                                                    <DatabaseExplorer
                                                        onTableSelect={
                                                            handleTableSelect
                                                        }
                                                        availableTables={
                                                            availableTables
                                                        }
                                                        tableSchemas={
                                                            tableSchemas
                                                        }
                                                        loadingSchemas={
                                                            loadingSchemas
                                                        }
                                                        sessionId={
                                                            selectedSession.sessionId
                                                        }
                                                        onLoadTableSchema={
                                                            async (tableName: string) => {
                                                                await loadTableSchema(tableName);
                                                            }
                                                        }
                                                    />
                                                ) : (
                                                    <Card>
                                                        <CardContent className="p-6 text-center">
                                                            <Database className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                                                            <p className="text-muted-foreground">
                                                                Create a secure
                                                                session to
                                                                explore the
                                                                database
                                                            </p>
                                                        </CardContent>
                                                    </Card>
                                                )}
                                            </TabsContent>
                                        </div>
                                    </Tabs>
                                </div>
                            </div>
                        </div>
                    </aside>
                ) : (
                    /* Collapsed Sidebar - Just Icon */
                    <div className="w-12 flex-shrink-0 bg-card border-r border-border h-[calc(100vh-81px)] flex flex-col items-center py-4 space-y-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsSidebarExpanded(true)}
                            className="h-10 w-10 p-0"
                            title="Expand Sidebar"
                        >
                            <Menu className="w-5 h-5" />
                        </Button>

                        {/* Tab indicators */}
                        <div className="flex flex-col space-y-1">
                            <Button
                                variant={
                                    sidebarTab === "connections"
                                        ? "default"
                                        : "ghost"
                                }
                                size="sm"
                                onClick={() => {
                                    setSidebarTab("connections");
                                    setIsSidebarExpanded(true);
                                }}
                                className="h-8 w-8 p-0"
                                title="Connections"
                            >
                                <Settings className="w-4 h-4" />
                            </Button>
                            <Button
                                variant={
                                    sidebarTab === "explorer"
                                        ? "default"
                                        : "ghost"
                                }
                                size="sm"
                                onClick={() => {
                                    setSidebarTab("explorer");
                                    setIsSidebarExpanded(true);
                                }}
                                className="h-8 w-8 p-0"
                                title="Database Explorer"
                            >
                                <Database className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                )}

                {/* Main Content */}
                <main className="flex-1 min-w-0 p-4 lg:p-6 space-y-4 lg:space-y-6">
                    {selectedSession ? (
                        <Tabs
                            value={activeTab}
                            onValueChange={setActiveTab}
                            className="w-full max-w-full space-y-4 lg:space-y-6"
                        >
                            <TabsList className="w-full sm:w-auto">
                                <TabsTrigger
                                    value="query"
                                    className="flex items-center space-x-2 flex-1 sm:flex-none"
                                >
                                    <Code className="w-4 h-4" />
                                    <span>Query Editor</span>
                                </TabsTrigger>
                                <TabsTrigger
                                    value="ai"
                                    className="flex items-center space-x-2 flex-1 sm:flex-none"
                                >
                                    <Brain className="w-4 h-4" />
                                    <span>AI Generator</span>
                                </TabsTrigger>
                                <TabsTrigger
                                    value="history"
                                    className="flex items-center space-x-2 flex-1 sm:flex-none"
                                >
                                    <History className="w-4 h-4" />
                                    <span>History</span>
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="query" className="w-full">
                                <QueryEditor
                                    session={selectedSession}
                                    onQueryExecute={handleQueryExecuted}
                                    initialQuery={queryToExecute}
                                    availableTables={availableTables}
                                    tableSchemas={tableSchemas}
                                    persistentTabs={getCurrentTabData()}
                                    onTabsUpdate={handleQueryTabsUpdate}
                                />
                            </TabsContent>

                            <TabsContent value="ai" className="w-full">
                                <LLMQueryGenerator
                                        availableTables={availableTables}
                                        tableSchemas={tableSchemas}
                                        onQueryRun={(query) => {
                                            setQueryToExecute(query);
                                            setActiveTab("query");
                                        }}
                                        onQueryRunNewTab={(query) => {
                                            // Create new tab with the AI generated query
                                            const newTabId = `tab-${Date.now()}`;
                                            const currentData =
                                                getCurrentTabData();
                                            const newTab: QueryTab = {
                                                id: newTabId,
                                                title: `AI Query ${
                                                    currentData.tabs.length + 1
                                                }`,
                                                query: query,
                                            };
                                            const updatedTabs = [
                                                ...currentData.tabs,
                                                newTab,
                                            ];
                                            handleQueryTabsUpdate(
                                                updatedTabs,
                                                newTabId
                                            );
                                            setActiveTab("query");
                                        }}
                                        sessionId={selectedSession?.sessionId}
                                        databaseType={selectedSession?.type}
                                        connectionName={selectedSession?.name}
                                        prefilledPrompt={aiPrefilledData.prompt}
                                        prefilledTables={aiPrefilledData.tables}
                                        onLoadTableSchemas={loadTableSchemas}
                                    />
                            </TabsContent>

                            <TabsContent value="history" className="w-full">
                                <QueryHistory
                                    onQuerySelect={(query) => {
                                        setQueryToExecute(query);
                                        setActiveTab("query");
                                    }}
                                    onQuerySelectNewTab={(query) => {
                                        // Create new tab with the query
                                        const newTabId = `tab-${Date.now()}`;
                                        const currentData = getCurrentTabData();
                                        const newTab: QueryTab = {
                                            id: newTabId,
                                            title: `Query ${
                                                currentData.tabs.length + 1
                                            }`,
                                            query: query,
                                        };
                                        const updatedTabs = [
                                            ...currentData.tabs,
                                            newTab,
                                        ];
                                        handleQueryTabsUpdate(
                                            updatedTabs,
                                            newTabId
                                        );
                                        setActiveTab("query");
                                    }}
                                    onAIPromptSelect={handleAIPromptSelect}
                                    onAIQueryRun={(query) => {
                                        setQueryToExecute(query);
                                        setActiveTab("query");
                                    }}
                                    onAIQueryRunNewTab={(query) => {
                                        // Create new tab with the AI generated query
                                        const newTabId = `tab-${Date.now()}`;
                                        const currentData = getCurrentTabData();
                                        const newTab: QueryTab = {
                                            id: newTabId,
                                            title: `AI Query ${
                                                currentData.tabs.length + 1
                                            }`,
                                            query: query,
                                        };
                                        const updatedTabs = [
                                            ...currentData.tabs,
                                            newTab,
                                        ];
                                        handleQueryTabsUpdate(
                                            updatedTabs,
                                            newTabId
                                        );
                                        setActiveTab("query");
                                    }}
                                    currentConnection={selectedSession?.name}
                                />
                            </TabsContent>
                        </Tabs>
                    ) : (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center space-x-2">
                                    <Database className="w-6 h-6" />
                                    <span>Welcome to Database Admin Tool</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <p className="text-muted-foreground">
                                    Get started by creating a database
                                    connection from the sidebar. This tool
                                    supports:
                                </p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex items-center space-x-2">
                                        <Badge variant="outline">MySQL</Badge>
                                        <span className="text-sm">
                                            Direct & Proxy support
                                        </span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Badge variant="outline">
                                            PostgreSQL
                                        </Badge>
                                        <span className="text-sm">
                                            Full featured support
                                        </span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Badge variant="outline">SQLite</Badge>
                                        <span className="text-sm">
                                            Local database files
                                        </span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Badge variant="outline">
                                            AI Powered
                                        </Badge>
                                        <span className="text-sm">
                                            Natural language queries
                                        </span>
                                    </div>
                                </div>

                                <div className="bg-muted/50 border border-border rounded-lg p-4">
                                    <h3 className="font-semibold text-foreground mb-2">
                                        Key Features:
                                    </h3>
                                    <ul className="text-sm text-muted-foreground space-y-1">
                                        <li>
                                            • Visual database schema exploration
                                        </li>
                                        <li>
                                            • Advanced SQL query editor with
                                            syntax highlighting
                                        </li>
                                        <li>
                                            • AI-powered query generation from
                                            natural language
                                        </li>
                                        <li>
                                            • Query history and result export
                                        </li>
                                        <li>• Multiple database connections</li>
                                    </ul>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </main>
            </div>
        </div>
    );
}
