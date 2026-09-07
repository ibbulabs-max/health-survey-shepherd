import React, { useState } from "react";
import { MoreVertical, ShieldAlert, Key, UserCog } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  updateUserRoleAdmin,
  updateUserSupervisorAdmin,
  resetUserPinAdmin,
} from "@/services/adminService";
import type { AppRole } from "@/config/roles";

interface Props {
  userId: string;
  currentRole: AppRole | "none";
  userName: string;
  supervisors: { id: string; name: string }[];
}

export function AdminUserActions({ userId, currentRole, userName, supervisors }: Props) {
  const queryClient = useQueryClient();
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);

  const [newRole, setNewRole] = useState<AppRole>(
    currentRole === "none" ? "survey_user" : currentRole,
  );
  const [newSupervisor, setNewSupervisor] = useState("");
  const [newPin, setNewPin] = useState("");

  const updateRoleMutation = useMutation({
    mutationFn: async () => {
      await updateUserRoleAdmin({ data: { userId, role: newRole } });
      if (newRole === "survey_user" && newSupervisor) {
        await updateUserSupervisorAdmin({ data: { cswId: userId, supervisorId: newSupervisor } });
      }
    },
    onSuccess: () => {
      toast.success("User role updated");
      setRoleDialogOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to update role"),
  });

  const updatePinMutation = useMutation({
    mutationFn: async () => {
      if (newPin.length !== 6) throw new Error("PIN must be 6 digits");
      await resetUserPinAdmin({ data: { userId, pin: newPin } });
    },
    onSuccess: () => {
      toast.success("User PIN reset successfully. They must change it on next login.");
      setPinDialogOpen(false);
      setNewPin("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to reset PIN"),
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
            <MoreVertical className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => setRoleDialogOpen(true)}>
            <UserCog className="mr-2 h-4 w-4" />
            <span>Change Role</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setPinDialogOpen(true)}
            className="text-rose-600 focus:text-rose-600"
          >
            <Key className="mr-2 h-4 w-4" />
            <span>Reset PIN</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Role Change Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Role: {userName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrator</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="survey_user">CSW / CHW</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newRole === "survey_user" && (
              <div className="space-y-2">
                <Label>Assign Supervisor</Label>
                <Select value={newSupervisor} onValueChange={setNewSupervisor}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a supervisor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {supervisors.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                    {supervisors.length === 0 && (
                      <SelectItem value="none" disabled>
                        No supervisors available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setRoleDialogOpen(false)}
              disabled={updateRoleMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => updateRoleMutation.mutate()}
              disabled={updateRoleMutation.isPending}
            >
              {updateRoleMutation.isPending ? "Saving..." : "Save Role"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* PIN Reset Dialog */}
      <Dialog open={pinDialogOpen} onOpenChange={setPinDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset PIN: {userName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>New 6-Digit PIN</Label>
              <Input
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                placeholder="e.g. 123456"
              />
              <p className="text-xs text-muted-foreground mt-1">
                The user will be required to change this PIN on their next login.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setPinDialogOpen(false)}
              disabled={updatePinMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => updatePinMutation.mutate()}
              disabled={updatePinMutation.isPending || newPin.length !== 6}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {updatePinMutation.isPending ? "Resetting..." : "Confirm Reset"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
