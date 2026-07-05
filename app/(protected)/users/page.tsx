import { ShieldAlert, UserCog } from "lucide-react";

import { toggleUserStatusAction } from "@/lib/actions/pharmacy";
import { UserForm } from "@/components/forms/user-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { getUsersData } from "@/lib/data/pharmacy";

export default async function UsersPage({
  searchParams
}: {
  searchParams?: {
    error?: string;
  };
}) {
  const data = await getUsersData();

  return (
    <div className="space-y-6">
      {searchParams?.error ? (
        <Card className="bg-rose-50">
          <div className="flex items-center gap-3 text-sm font-semibold text-rose-900">
            <ShieldAlert className="h-5 w-5 text-rose-700" />
            {decodeURIComponent(searchParams.error)}
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Create or update users" description="Admins can provision accounts, assign roles, and control store access." action={<Badge variant="accent">Admin only</Badge>} />
        <UserForm actionLabel="Save user account" />
      </Card>

      <Card>
        <CardHeader title="Active users" description="Manage role assignments, account status, and operational access." action={<Badge variant="success">{data.profiles.length} accounts</Badge>} />
        <Table>
          <TableHead>
            <tr>
              <TableHeaderCell>User</TableHeaderCell>
              <TableHeaderCell>Role</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Created</TableHeaderCell>
              <TableHeaderCell>Actions</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {data.profiles.map((profile) => (
              <TableRow key={profile.id}>
                <TableCell>
                  <p className="font-semibold text-slate-950">{profile.full_name || "No name"}</p>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{profile.email}</p>
                </TableCell>
                <TableCell>
                  <Badge variant={profile.role === "admin" ? "accent" : "neutral"}>{profile.role}</Badge>
                </TableCell>
                <TableCell>{profile.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="danger">Disabled</Badge>}</TableCell>
                <TableCell>{profile.created_at?.slice(0, 10) ?? "N/A"}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-3">
                    <details className="rounded-2xl border border-slate-200 bg-white">
                      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-brand-700">
                        <UserCog className="h-4 w-4" />
                        Edit profile
                      </summary>
                      <div className="border-t border-slate-200 p-4">
                        <UserForm initial={profile} actionLabel="Update user" />
                      </div>
                    </details>

                    <form action={toggleUserStatusAction}>
                      <input type="hidden" name="profile_id" value={profile.id} />
                      <input type="hidden" name="is_active" value={profile.is_active ? "false" : "true"} />
                      <Button type="submit" variant="secondary" className="w-full justify-start">
                        {profile.is_active ? "Disable account" : "Reactivate account"}
                      </Button>
                    </form>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

    </div>
  );
}

