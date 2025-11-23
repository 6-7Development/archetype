import { AlertCircle, CheckCircle2, AlertTriangle, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * ✅ GAP #4: Validation Metadata Display Component
 * 
 * Renders tool result validation metadata with visual indicators:
 * - Tool execution success/failure status
 * - Truncation warnings
 * - Schema validation status
 * - Aggregated warnings from multiple tools
 */

interface ValidationMetadataDisplayProps {
  metadata?: {
    valid?: boolean;
    truncated?: boolean;
    warnings?: string[];
    schemaValidated?: boolean;
  };
  toolName?: string;
}

export function ValidationMetadataDisplay({ metadata, toolName }: ValidationMetadataDisplayProps) {
  if (!metadata) return null;

  const isValid = metadata.valid ?? true;
  const isTruncated = metadata.truncated ?? false;
  const isSchemaValidated = metadata.schemaValidated ?? true;
  const warnings = metadata.warnings ?? [];

  return (
    <Card className="mt-2 border-l-4" style={{
      borderLeftColor: isValid ? 'hsl(var(--success))' : 'hsl(var(--destructive))'
    }}>
      <CardContent className="pt-3 pb-3">
        <div className="space-y-2">
          {/* Status Row */}
          <div className="flex items-center gap-2">
            {isValid ? (
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600" />
            )}
            <span className="text-sm font-medium">
              {toolName ? `${toolName}: ` : ''}
              {isValid ? 'Tool executed successfully' : 'Tool execution failed'}
            </span>
          </div>

          {/* Metadata Details */}
          <div className="ml-6 space-y-1 text-xs text-muted-foreground">
            {/* Truncation Warning */}
            {isTruncated && (
              <div className="flex items-center gap-2 text-yellow-600">
                <AlertTriangle className="w-3 h-3" />
                <span>Output was truncated due to size limits</span>
              </div>
            )}

            {/* Schema Validation */}
            <div className="flex items-center gap-2">
              <Zap className="w-3 h-3" />
              <span>
                Schema validation: {isSchemaValidated ? '✓ Passed' : '✗ Failed'}
              </span>
            </div>

            {/* Warnings List */}
            {warnings.length > 0 && (
              <div className="mt-2 pl-5 border-l border-yellow-200">
                <div className="text-yellow-700 font-medium text-xs mb-1">
                  {warnings.length} warning{warnings.length !== 1 ? 's' : ''}:
                </div>
                <ul className="list-disc text-yellow-600 space-y-0.5">
                  {warnings.map((warning, idx) => (
                    <li key={idx} className="text-xs">
                      {warning}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
