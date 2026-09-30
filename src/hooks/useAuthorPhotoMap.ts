import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import { employeeApi, Employee } from "@/services/employees";

export function useAuthorPhotoMap(assignees?: any[]) {
  const currentUser = useAuthStore((s) => s.user);

  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ["employees-simple-dropdown-for-avatars"],
    queryFn: () => employeeApi.simpleDropdown(),
    staleTime: 5 * 60 * 1000,
  });

  return useMemo(() => {
    const map: Record<string, string> = {};

    // 1. Current logged-in user
    if (currentUser) {
      const pic = currentUser.profile_picture || (currentUser as any).profile_picture_url;
      if (pic) {
        if (currentUser.full_name) map[currentUser.full_name.toLowerCase()] = pic;
        if (currentUser.username) map[currentUser.username.toLowerCase()] = pic;
      }
    }

    // 2. Item assignees
    if (assignees && Array.isArray(assignees)) {
      for (const a of assignees) {
        const pic = a.profile_picture_url || a.profile_picture;
        if (pic) {
          if (a.full_name) map[a.full_name.toLowerCase()] = pic;
          if (a.username) map[a.username.toLowerCase()] = pic;
          if (a.name) map[a.name.toLowerCase()] = pic;
        }
      }
    }

    // 3. All employees list
    if (Array.isArray(employees)) {
      for (const emp of employees) {
        const pic = emp.profile_picture || emp.profile_picture_url;
        if (pic) {
          if (emp.full_name) map[emp.full_name.toLowerCase()] = pic;
          if (emp.username) map[emp.username.toLowerCase()] = pic;
          const fullNameFromParts = `${emp.first_name || ""} ${emp.last_name || ""}`.trim();
          if (fullNameFromParts) map[fullNameFromParts.toLowerCase()] = pic;
        }
      }
    }

    return map;
  }, [currentUser, assignees, employees]);
}
