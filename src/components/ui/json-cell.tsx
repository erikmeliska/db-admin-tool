'use client';

import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Badge } from './badge';
import { Button } from './button';

interface JsonCellProps {
  value: unknown;
}

export function JsonCell({ value }: JsonCellProps) {
  // Check if the value is an object or array
  const isJsonLike = (val: unknown): boolean => {
    return (
      val !== null &&
      typeof val === 'object' &&
      (Array.isArray(val) || val.constructor === Object)
    );
  };

  // Check if the value is a JSON string
  const isJsonString = (val: unknown): boolean => {
    if (typeof val !== 'string') return false;
    try {
      const parsed = JSON.parse(val);
      return isJsonLike(parsed);
    } catch {
      return false;
    }
  };

  const formatJson = (val: unknown): string => {
    try {
      if (typeof val === 'string') {
        // Try to parse if it's a JSON string
        const parsed = JSON.parse(val);
        return JSON.stringify(parsed, null, 2);
      }
      return JSON.stringify(val, null, 2);
    } catch {
      return String(val);
    }
  };

  const getDisplayText = (val: unknown): string => {
    if (isJsonLike(val) || isJsonString(val)) {
      try {
        const parsed = typeof val === 'string' ? JSON.parse(val) : val;
        
        if (Array.isArray(parsed)) {
          return `Array (${parsed.length} items)`;
        } else if (typeof parsed === 'object' && parsed !== null) {
          const keys = Object.keys(parsed);
          return `Object (${keys.length} ${keys.length === 1 ? 'key' : 'keys'})`;
        }
      } catch {
        // fallback to string representation
      }
    }
    return String(val);
  };

  const getByteSize = (val: unknown): number => {
    const str = typeof val === 'string' ? val : JSON.stringify(val);
    return new Blob([str]).size;
  };

  // If it's not JSON-like, render normally
  if (!isJsonLike(value) && !isJsonString(value)) {
    const stringValue = String(value);
    if (stringValue.length > 50 || stringValue.includes('\n')) {
      return (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" className="h-6 p-1 text-left font-normal text-xs w-full justify-start">
              <div className="truncate w-full">
                {stringValue.replace(/\s+/g, ' ').substring(0, 40)}...
              </div>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-96 max-h-96 overflow-auto">
            <div className="space-y-2">
              <div className="font-semibold">Full Text</div>
              <div className="text-sm whitespace-pre-wrap break-words">
                {stringValue}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      );
    }
    return <span className="truncate text-xs block w-full">{stringValue}</span>;
  }

  // For JSON data
  const displayText = getDisplayText(value);
  const formattedJson = formatJson(value);
  const byteSize = getByteSize(value);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="h-6 p-1 text-left font-normal text-xs w-full justify-start">
          <div className="flex items-center space-x-1 w-full min-w-0">
            <span className="truncate flex-1">{displayText}</span>
            <Badge variant="secondary" className="text-xs flex-shrink-0">
              {byteSize < 1024 ? `${byteSize}B` : `${(byteSize / 1024).toFixed(1)}KB`}
            </Badge>
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 max-h-96 overflow-auto" side="left">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold">JSON Data</span>
            <div className="flex space-x-2">
              <Badge variant="outline" className="text-xs">
                {byteSize < 1024 ? `${byteSize} bytes` : `${(byteSize / 1024).toFixed(1)} KB`}
              </Badge>
            </div>
          </div>
          <div className="relative">
            <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-80 whitespace-pre-wrap break-words">
              <code>{formattedJson}</code>
            </pre>
            <Button
              variant="outline"
              size="sm"
              className="absolute top-2 right-2 text-xs h-6"
              onClick={() => {
                navigator.clipboard.writeText(formattedJson);
              }}
            >
              Copy
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
} 