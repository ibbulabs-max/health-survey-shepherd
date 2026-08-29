import { useState } from "react";
import { CheckCircle2, Edit2, Target } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

interface FollowUpTargetProps {
  completedTodayCount: number;
}

export function FollowUpTarget({ completedTodayCount }: FollowUpTargetProps) {
  const { isAdmin, role } = useAuth();
  const { dailyTarget, updateDailyTarget } = useSettings();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(dailyTarget.toString());
  const canEdit = isAdmin || role === "supervisor";

  const remaining = Math.max(0, dailyTarget - completedTodayCount);
  const progress = dailyTarget > 0 ? Math.min(100, Math.round((completedTodayCount / dailyTarget) * 100)) : 100;

  const handleSave = async () => {
    const num = parseInt(editValue, 10);
    if (!isNaN(num) && num >= 0) {
      await updateDailyTarget(num);
      setIsEditing(false);
    }
  };

  return (
    <div className="flex items-center justify-between rounded-2xl bg-white/50 dark:bg-white/5 p-4 border border-white/20 dark:border-white/10 shadow-sm backdrop-blur-md">
      <div className="flex items-center gap-4 w-full">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Target className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Today's Target</h3>
            {canEdit && (
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground touch-target" onClick={() => setIsEditing(true)}>
                <Edit2 className="h-3 w-3" />
              </Button>
            )}
          </div>
          <div className="mt-1 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              <strong className="text-foreground">{completedTodayCount}</strong> of {dailyTarget} completed
            </span>
            {remaining === 0 ? (
              <span className="flex items-center gap-1 text-emerald-600 font-medium">
                <CheckCircle2 className="h-3 w-3" /> Target met!
              </span>
            ) : (
              <span className="text-primary font-medium">{remaining} remaining</span>
            )}
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div 
              className={`h-full transition-all duration-500 ease-out ${progress === 100 ? 'bg-emerald-500' : 'bg-primary'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="sm:max-w-[320px]">
          <DialogHeader>
            <DialogTitle>Set Daily Target</DialogTitle>
            <DialogDescription>Set the target number of follow-ups for today.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input 
              type="number" 
              min="0"
              value={editValue} 
              onChange={(e) => setEditValue(e.target.value)} 
              placeholder="E.g. 20"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save Target</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
