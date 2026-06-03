export type AppRole =
  | "admin" | "manager" | "helper" | "viewer"
  | "bookkeeper" | "animal_care" | "volunteer" | "pending";

export const ALL_ROLES: AppRole[] = [
  "admin","manager","helper","viewer","bookkeeper","animal_care","volunteer","pending",
];

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Admin",
  manager: "Manager",
  helper: "Helper",
  viewer: "Viewer",
  bookkeeper: "Bookkeeper",
  animal_care: "Animal Care",
  volunteer: "Volunteer",
  pending: "Pending",
};

/** Permission catalog grouped for the role editor UI. Wildcard "*" = full access (admin). */
export const PERMISSION_GROUPS: { group: string; permissions: { key: string; label: string }[] }[] = [
  {
    group: "Dashboard",
    permissions: [{ key: "dashboard.view", label: "View dashboard" }],
  },
  {
    group: "Animals",
    permissions: [
      { key: "animals.view", label: "View animals" },
      { key: "animals.view.assigned", label: "View assigned animals" },
      { key: "animals.create", label: "Add animals" },
      { key: "animals.edit", label: "Edit animals" },
      { key: "animals.notes.add", label: "Add animal notes" },
      { key: "animals.weights.add", label: "Add animal weights" },
      { key: "photos.upload", label: "Upload photos" },
      { key: "breeding.create", label: "Add breeding records" },
      { key: "health.create", label: "Add health records" },
      { key: "health.edit", label: "Edit health records" },
    ],
  },
  {
    group: "Feed & Inventory",
    permissions: [
      { key: "feed.view", label: "View feed" },
      { key: "feed.create", label: "Add feed records" },
      { key: "feed.edit", label: "Edit feed records" },
      { key: "inventory.view", label: "View inventory" },
      { key: "inventory.create", label: "Add inventory" },
      { key: "inventory.edit", label: "Edit inventory" },
    ],
  },
  {
    group: "Chores",
    permissions: [
      { key: "chores.view", label: "View chores" },
      { key: "chores.view.assigned", label: "View assigned chores" },
      { key: "chores.create", label: "Add chores" },
      { key: "chores.edit", label: "Edit chores" },
      { key: "chores.complete", label: "Complete chores" },
    ],
  },
  {
    group: "Finances",
    permissions: [
      { key: "finances.view", label: "View finances" },
      { key: "finances.create", label: "Add finances" },
      { key: "finances.edit", label: "Edit finances" },
    ],
  },
  {
    group: "Reports",
    permissions: [
      { key: "reports.view", label: "View reports" },
      { key: "reports.export", label: "Export reports" },
    ],
  },
  {
    group: "Admin",
    permissions: [
      { key: "users.manage", label: "Manage users" },
      { key: "roles.manage", label: "Manage roles" },
    ],
  },
];

export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => p.key));
