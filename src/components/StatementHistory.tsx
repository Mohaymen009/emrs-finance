import { useState, useEffect } from "react";
import { SavedStatement } from "@/types/invoice";
import { getSavedStatements, deleteSavedStatement } from "@/utils/storage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { FileText, Calendar, Trash2, Eye, User, Download } from "lucide-react";

interface StatementHistoryProps {
  onLoadStatement: (statement: SavedStatement) => void;
  onDownloadStatement?: (statement: SavedStatement) => void;
}

export function StatementHistory({ onLoadStatement, onDownloadStatement }: StatementHistoryProps) {
  const [savedStatements, setSavedStatements] = useState<SavedStatement[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from localStorage on mount, not derived from props/state
    setSavedStatements(getSavedStatements());
  }, []);

  const handleDelete = (id: string) => {
    if (deleteSavedStatement(id)) {
      setSavedStatements(getSavedStatements());
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  };

  if (savedStatements.length === 0) {
    return (
      <Card className="h-[300px] sm:h-[400px] flex items-center justify-center">
        <CardContent className="text-center px-4">
          <FileText className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-3 sm:mb-4" />
          <h3 className="text-base sm:text-lg font-medium text-foreground mb-2">No Saved Statements</h3>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto">Your downloaded statements will appear here for easy access.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-[350px] sm:h-[400px]">
      <CardHeader className="pb-3 px-4 sm:px-6">
        <CardTitle className="text-base sm:text-lg font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
          Saved Statements ({savedStatements.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[270px] sm:h-[320px]">
          <div className="p-3 sm:p-4 space-y-2 sm:space-y-3">
            {savedStatements.map((statement) => (
              <Card key={statement.id} className="p-3 sm:p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-2">
                      <Badge variant="secondary" className="text-xs w-fit">{statement.data.statementNumber || "No Number"}</Badge>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {formatDate(statement.createdAt)}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span className="font-medium truncate">{statement.data.clientName || "No Client"}</span>
                      </div>
                      <div className="text-sm font-medium text-primary">{statement.data.closingBalance || "AED 0.00"}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => onLoadStatement(statement)} className="h-8 w-8 p-0" title="Load Statement">
                      <Eye className="h-4 w-4" />
                    </Button>
                    {onDownloadStatement && (
                      <Button size="sm" variant="ghost" onClick={() => onDownloadStatement(statement)} className="h-8 w-8 p-0" title="Download Statement">
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive" title="Delete Statement">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="mx-4 max-w-sm">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-lg">Delete Statement</AlertDialogTitle>
                          <AlertDialogDescription className="text-sm">Are you sure? This cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                          <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(statement.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full sm:w-auto">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
