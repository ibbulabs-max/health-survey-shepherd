import { useState, useEffect } from "react";
import { supabase } from "@/db/client";
import { ShieldAlert, CheckCircle2, AlertTriangle, Info, Clock, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ErrorAlertCenter() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("system_alerts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    
    if (data) setAlerts(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const markResolved = async (id: string) => {
    await supabase.from("system_alerts").update({ resolved: true }).eq("id", id);
    fetchAlerts();
  };

  if (loading) return <div>Loading alerts...</div>;

  return (
    <Card className="border-border/60 shadow-sm ios-glass-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="size-5 text-destructive" />
          Error & Alert Center
        </CardTitle>
        <CardDescription>
          Centralized monitoring for system exceptions, import failures, and bounds violations.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="text-sm text-muted-foreground p-4 text-center border rounded-md">
            No alerts found. System is healthy.
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map(alert => (
              <div key={alert.id} className={`p-4 rounded-xl border flex flex-col sm:flex-row justify-between gap-4 ${alert.resolved ? 'bg-muted/50 border-border/50' : 'bg-background border-border'}`}>
                <div className="flex gap-3 items-start overflow-hidden">
                  <div className="mt-0.5 shrink-0">
                    {alert.severity === 'error' && <AlertTriangle className="size-5 text-destructive" />}
                    {alert.severity === 'warning' && <AlertTriangle className="size-5 text-amber-500" />}
                    {alert.severity === 'info' && <Info className="size-5 text-blue-500" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        {alert.category}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="size-3" />
                        {new Date(alert.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className={`text-sm font-semibold mt-1 ${alert.resolved ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                      {alert.summary}
                    </p>
                    {alert.details && (
                      <pre className="mt-2 p-2 bg-muted rounded-md text-[10px] overflow-x-auto max-w-full">
                        {JSON.stringify(alert.details, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
                {!alert.resolved && (
                  <Button variant="outline" size="sm" onClick={() => markResolved(alert.id)} className="shrink-0">
                    <Check className="size-4 mr-1" /> Resolve
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
