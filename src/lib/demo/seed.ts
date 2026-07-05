// Realistic 6-month homestead seed for Demo Mode.
type Row = Record<string, unknown>;
type DB = Record<string, Row[]>;

const DEMO_USER_ID = "demo-user-0000-0000-0000-000000000000";

const daysAgo = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};
const daysAgoTs = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
};
const daysFromNow = (n: number): string => daysAgo(-n);

let idCounter = 0;
const id = (prefix = "s"): string => `demo-${prefix}-${(++idCounter).toString().padStart(6, "0")}`;

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const rnd = (min: number, max: number): number => Math.round((min + Math.random() * (max - min)) * 10) / 10;

export function buildSeed(): DB {
  idCounter = 0;
  const db: DB = {};
  const now = new Date().toISOString();

  // Profile + role so admin gates open
  db.profiles = [{ id: DEMO_USER_ID, display_name: "Demo Homesteader", email: "demo@evergrace.local", created_at: now, updated_at: now }];
  db.user_roles = [{ id: id("ur"), user_id: DEMO_USER_ID, role: "admin", created_at: now }];

  // ── Pens ─────────────────────────────────────────────────────────────
  const pens = [
    { name: "Goat Barn", species: "goat", capacity: 8, location: "North pasture" },
    { name: "Pig Pasture", species: "pig", capacity: 6, location: "East field" },
    { name: "Chicken Coop", species: "chicken", capacity: 20, location: "Yard" },
    { name: "Duck Pond", species: "duck", capacity: 10, location: "Lower field" },
    { name: "Kennel", species: "dog", capacity: 4, location: "House" },
    { name: "Quarantine", species: null, capacity: 4, location: "Barn stall" },
  ];
  db.pens = pens.map((p) => ({ id: id("pen"), ...p, active: true, notes: null, created_by: DEMO_USER_ID, created_at: now, updated_at: now }));

  // ── Animals ──────────────────────────────────────────────────────────
  const animals: Row[] = [];
  const mk = (o: Row): Row => ({
    id: id("an"),
    created_by: DEMO_USER_ID,
    created_at: now,
    updated_at: now,
    status: "active",
    ownership: "owned",
    breed_type: "purebred",
    photo_url: null,
    front_photo_url: null,
    side_photo_url: null,
    additional_photo_urls: [],
    temperament_tags: [],
    life_stage: "adult",
    manual_life_stage_override: false,
    temporary_record: false,
    ...o,
  });

  // Goats
  const willow = mk({ name: "Willow", species: "goat", breed: "Nigerian Dwarf", sex: "female", date_of_birth: daysAgo(1200), tag: "G-01", current_pen: "Goat Barn", status: "nursing", breeding_status: "lactating", nursing_started_at: daysAgo(60), weaning_due: daysFromNow(24), notes: "Excellent milker" });
  const clover = mk({ name: "Clover", species: "goat", breed: "Nubian", sex: "female", date_of_birth: daysAgo(900), tag: "G-02", current_pen: "Goat Barn", breeding_status: "bred" });
  const atlas = mk({ name: "Atlas", species: "goat", breed: "Boer", sex: "male", date_of_birth: daysAgo(1400), tag: "G-03", current_pen: "Goat Barn", is_intact_male: "intact" });
  animals.push(willow, clover, atlas);
  // Willow's kids
  const kid1 = mk({ name: "Sprout", species: "goat", breed: "Nigerian Dwarf", sex: "female", date_of_birth: daysAgo(60), tag: "G-04", current_pen: "Goat Barn", mother_id: willow.id, father_id: atlas.id, life_stage: "juvenile" });
  const kid2 = mk({ name: "Twig", species: "goat", breed: "Nigerian Dwarf", sex: "male", date_of_birth: daysAgo(60), tag: "G-05", current_pen: "Goat Barn", mother_id: willow.id, father_id: atlas.id, life_stage: "juvenile" });
  animals.push(kid1, kid2);

  // Pigs
  animals.push(
    mk({ name: "Petunia", species: "pig", breed: "Berkshire", sex: "female", date_of_birth: daysAgo(500), tag: "P-01", current_pen: "Pig Pasture" }),
    mk({ name: "Hamlet", species: "pig", breed: "Berkshire", sex: "male", date_of_birth: daysAgo(480), tag: "P-02", current_pen: "Pig Pasture", is_intact_male: "castrated", castration_date: daysAgo(420) }),
    mk({ name: "Rosie", species: "pig", breed: "Kunekune", sex: "female", date_of_birth: daysAgo(300), tag: "P-03", current_pen: "Pig Pasture" }),
  );

  // Chickens
  const roo = mk({ name: "Captain", species: "chicken", breed: "Rhode Island Red", sex: "male", date_of_birth: daysAgo(700), tag: "C-01", current_pen: "Chicken Coop", is_intact_male: "intact" });
  animals.push(roo);
  ["Henrietta","Buttercup","Marigold","Poppy","Daisy","Fern","Sage"].forEach((n, i) => {
    animals.push(mk({ name: n, species: "chicken", breed: i % 2 ? "Buff Orpington" : "Rhode Island Red", sex: "female", date_of_birth: daysAgo(400 + i * 20), tag: `C-${(i + 2).toString().padStart(2, "0")}`, current_pen: "Chicken Coop" }));
  });

  // Ducks
  ["Puddle","Splash","Quackers"].forEach((n, i) => {
    animals.push(mk({ name: n, species: "duck", breed: "Pekin", sex: i === 2 ? "male" : "female", date_of_birth: daysAgo(350 + i * 30), tag: `D-${(i + 1).toString().padStart(2, "0")}`, current_pen: "Duck Pond" }));
  });

  // Dogs (LGDs)
  animals.push(
    mk({ name: "Bear", species: "dog", breed: "Great Pyrenees", sex: "male", date_of_birth: daysAgo(1500), tag: "K-01", current_pen: "Kennel", is_intact_male: "castrated", castration_date: daysAgo(1200) }),
    mk({ name: "Luna", species: "dog", breed: "Anatolian Shepherd", sex: "female", date_of_birth: daysAgo(1000), tag: "K-02", current_pen: "Kennel" }),
  );

  // Cats
  animals.push(
    mk({ name: "Mouser", species: "cat", breed: "Barn Cat", sex: "male", date_of_birth: daysAgo(800), tag: "F-01", current_pen: null, is_intact_male: "castrated" }),
    mk({ name: "Ginger", species: "cat", breed: "Tabby", sex: "female", date_of_birth: daysAgo(600), tag: "F-02", current_pen: null }),
  );

  db.animals = animals;

  // ── Litters (Willow's kidding, 60 days ago) ─────────────────────────
  const litter = { id: id("lit"), mother_id: willow.id, father_id: atlas.id, birth_date: daysAgo(60), male_count: 1, female_count: 1, unknown_count: 0, notes: "Uneventful kidding, both healthy", created_by: DEMO_USER_ID, created_at: now, updated_at: now };
  db.litters = [litter];
  (kid1 as Row).litter_id = litter.id;
  (kid2 as Row).litter_id = litter.id;

  // ── Pregnancies ─────────────────────────────────────────────────────
  db.pregnancies = [
    { id: id("preg"), animal_id: willow.id, sire_id: atlas.id, bred_date: daysAgo(210), expected_due: daysAgo(60), actual_birth: daysAgo(60), status: "delivered", offspring_count: 2, survived_count: 2, male_born: 1, female_born: 1, stillborn_count: 0, breeding_method: "natural", notes: "Delivered normally", created_by: DEMO_USER_ID, created_at: now, updated_at: now },
    { id: id("preg"), animal_id: clover.id, sire_id: atlas.id, bred_date: daysAgo(130), expected_due: daysFromNow(20), status: "confirmed", offspring_count: null, breeding_method: "natural", notes: "Ultrasound confirmed", created_by: DEMO_USER_ID, created_at: now, updated_at: now },
  ];

  // ── Health records ──────────────────────────────────────────────────
  const health: Row[] = [];
  const hh = (o: Row) => health.push({ id: id("hr"), created_by: DEMO_USER_ID, created_at: now, updated_at: now, ...o });
  animals.filter((a) => a.species === "goat").forEach((a) => {
    hh({ animal_id: a.id, record_type: "vaccination", product: "CDT", administered_on: daysAgo(150), notes: "Annual booster" });
    hh({ animal_id: a.id, record_type: "deworming", product: "Ivermectin", dosage: "1cc/50lb", administered_on: daysAgo(90), withdrawal_meat_until: daysAgo(76), withdrawal_milk_until: daysAgo(80) });
    hh({ animal_id: a.id, record_type: "hoof_trim", product: null, administered_on: daysAgo(30) });
  });
  animals.filter((a) => a.species === "pig").forEach((a, i) => {
    hh({ animal_id: a.id, record_type: "vaccination", product: "Erysipelas", administered_on: daysAgo(180 - i * 5) });
  });
  hh({ animal_id: animals.find((a) => a.name === "Bear")!.id, record_type: "vaccination", product: "Rabies", administered_on: daysAgo(200), cost_cents: 4500 });
  hh({ animal_id: animals.find((a) => a.name === "Luna")!.id, record_type: "vaccination", product: "DAPP", administered_on: daysAgo(210), cost_cents: 3200 });
  db.health_records = health;

  // ── Weight logs (monthly for pigs & goats) ──────────────────────────
  const weights: Row[] = [];
  animals.filter((a) => a.species === "pig" || a.species === "goat").forEach((a) => {
    const baseW = a.species === "pig" ? 180 : 55;
    for (let m = 5; m >= 0; m--) {
      weights.push({ id: id("w"), animal_id: a.id, weight: baseW + m * rnd(4, 10) + rnd(-3, 3), unit: "lb", weighed_on: daysAgo(m * 30), notes: null, created_by: DEMO_USER_ID, created_at: now });
    }
  });
  db.weight_logs = weights;

  // ── Feed items / units / containers / stock ─────────────────────────
  const units = [
    { id: id("u"), name: "lb", lbs_per_unit: 1, is_system: true },
    { id: id("u"), name: "scoop (2 lb)", lbs_per_unit: 2, is_system: false },
    { id: id("u"), name: "flake (5 lb)", lbs_per_unit: 5, is_system: false },
  ].map((u) => ({ ...u, created_by: DEMO_USER_ID, created_at: now, updated_at: now }));
  db.feed_units = units;

  const containers = [
    { name: "Barn Bin A", capacity_lbs: 500, location: "Feed room" },
    { name: "Barn Bin B", capacity_lbs: 300, location: "Feed room" },
    { name: "Coop Can", capacity_lbs: 50, location: "Coop" },
  ].map((c) => ({ id: id("cn"), ...c, active: true, notes: null, created_by: DEMO_USER_ID, created_at: now, updated_at: now }));
  db.feed_containers = containers;

  const feeds = [
    { name: "Layer Pellets 50lb", store: "Tractor Supply", price_cents: 2199, unit: "lb", stock_qty: 120, low_stock_threshold: 50, species_for: "chicken", package_size: 50 },
    { name: "Goat Grain 40lb", store: "Local Co-op", price_cents: 2450, unit: "lb", stock_qty: 80, low_stock_threshold: 30, species_for: "goat", package_size: 40 },
    { name: "Pig Grower 50lb", store: "Tractor Supply", price_cents: 2699, unit: "lb", stock_qty: 150, low_stock_threshold: 50, species_for: "pig", package_size: 50 },
    { name: "Duck Crumble 40lb", store: "Local Co-op", price_cents: 2350, unit: "lb", stock_qty: 35, low_stock_threshold: 40, species_for: "duck", package_size: 40 },
    { name: "Alfalfa Hay", store: "Neighbor farm", price_cents: 1800, unit: "flake", stock_qty: 45, low_stock_threshold: 15, species_for: "goat", package_size: 5 },
    { name: "Dog Kibble 30lb", store: "Chewy", price_cents: 4599, unit: "lb", stock_qty: 22, low_stock_threshold: 15, species_for: "dog", package_size: 30 },
  ].map((f) => ({ id: id("f"), ...f, notes: null, created_by: DEMO_USER_ID, created_at: now, updated_at: now }));
  db.feed_items = feeds;

  // container stock split
  const stock: Row[] = [];
  feeds.forEach((f) => {
    stock.push({ id: id("s"), container_id: containers[f.name.includes("Layer") || f.name.includes("Duck") ? 2 : 0].id, feed_item_id: f.id, stock_lbs: Number(f.stock_qty), updated_at: now });
  });
  db.feed_container_stock = stock;

  // Purchases — 2 per feed over 6 months
  const purchases: Row[] = [];
  feeds.forEach((f, i) => {
    for (let k = 0; k < 3; k++) {
      const bagLbs = Number(f.package_size) || 50;
      purchases.push({
        id: id("pur"), feed_item_id: f.id, store: f.store, price_cents: Number(f.price_cents) * 2,
        quantity: 2, purchased_on: daysAgo(30 + k * 60 + i * 3),
        container_id: containers[0].id, unit_type: "bag", bag_size_lbs: bagLbs, bag_count: 2,
        total_lbs: bagLbs * 2, cost_per_bag_cents: Number(f.price_cents),
        notes: null, created_by: DEMO_USER_ID, created_at: now,
      });
    }
  });
  db.feed_purchases = purchases;

  // Daily feed logs — 60 days, one entry per feed per day (approx)
  const logs: Row[] = [];
  for (let d = 60; d >= 0; d--) {
    feeds.forEach((f, i) => {
      if ((d + i) % 2 !== 0) return; // stagger
      const lbs = rnd(3, 10);
      logs.push({
        id: id("fl"), feed_item_id: f.id, animal_id: null, quantity: lbs, fed_on: daysAgo(d),
        container_id: containers[0].id, unit_id: units[0].id, unit_qty: lbs, total_lbs: lbs,
        target_type: "species", target_value: f.species_for, notes: null,
        created_by: DEMO_USER_ID, created_at: daysAgoTs(d),
      });
    });
  }
  db.feed_logs = logs;

  // ── Production logs (eggs) — 90 days ────────────────────────────────
  const prod: Row[] = [];
  for (let d = 90; d >= 0; d--) {
    prod.push({ id: id("pr"), animal_id: null, group_label: "Chicken Coop", product_type: "eggs", quantity: Math.floor(rnd(4, 8)), unit: "count", produced_on: daysAgo(d), value_cents: null, notes: null, created_by: DEMO_USER_ID, created_at: daysAgoTs(d) });
    if (d % 2 === 0) prod.push({ id: id("pr"), animal_id: null, group_label: "Duck Pond", product_type: "eggs", quantity: Math.floor(rnd(1, 4)), unit: "count", produced_on: daysAgo(d), value_cents: null, notes: null, created_by: DEMO_USER_ID, created_at: daysAgoTs(d) });
  }
  // Milk from Willow (last 40 days)
  for (let d = 40; d >= 0; d--) {
    prod.push({ id: id("pr"), animal_id: willow.id, group_label: null, product_type: "milk", quantity: rnd(1.5, 2.5), unit: "quart", produced_on: daysAgo(d), value_cents: null, notes: null, created_by: DEMO_USER_ID, created_at: daysAgoTs(d) });
  }
  db.production_logs = prod;

  // ── Chores + completions ────────────────────────────────────────────
  const chores = [
    { title: "Morning feed & water", category: "feeding", recurrence: "daily", due_time: "07:00:00" },
    { title: "Evening feed & lockup", category: "feeding", recurrence: "daily", due_time: "18:30:00" },
    { title: "Collect eggs", category: "production", recurrence: "daily", due_time: "10:00:00" },
    { title: "Clean coop", category: "cleaning", recurrence: "weekly", days_of_week: ["saturday"] },
    { title: "Muck goat barn", category: "cleaning", recurrence: "weekly", days_of_week: ["sunday"] },
    { title: "Milk Willow", category: "production", recurrence: "daily", due_time: "07:30:00" },
    { title: "Refill mineral feeders", category: "feeding", recurrence: "weekly", days_of_week: ["monday"] },
    { title: "Check fencing", category: "maintenance", recurrence: "weekly", days_of_week: ["friday"] },
  ].map((c) => ({ id: id("ch"), ...c, notes: null, day_of_month: null, start_date: daysAgo(90), end_date: null, active: true, days_of_week: (c as Row).days_of_week ?? [], due_time: (c as Row).due_time ?? null, created_by: DEMO_USER_ID, created_at: now, updated_at: now }));
  db.chores = chores;
  const comps: Row[] = [];
  chores.forEach((c) => {
    for (let d = 30; d >= 1; d--) {
      if (c.recurrence === "weekly" && d % 7 !== 0) continue;
      if (Math.random() < 0.15) continue; // occasional miss
      comps.push({ id: id("cc"), chore_id: c.id, instance_date: daysAgo(d), completed_by: DEMO_USER_ID, completed_at: daysAgoTs(d), notes: null });
    }
  });
  db.chore_completions = comps;

  // ── Tasks ───────────────────────────────────────────────────────────
  const openTasks = [
    { title: "Book vet — Clover kidding check", category: "health", due_date: daysFromNow(3) },
    { title: "Order chick starter", category: "supply", due_date: daysFromNow(7) },
    { title: "Repair coop latch", category: "maintenance", due_date: daysFromNow(1) },
    { title: "Trim goat hooves", category: "health", due_date: daysFromNow(14) },
    { title: "Move ducks to spring paddock", category: "operations", due_date: daysFromNow(21) },
    { title: "Reserve butcher date for Hamlet", category: "operations", due_date: daysFromNow(45) },
  ];
  const doneTasks = [
    "Restock hay","Deworm goats","Vet visit — Bear","Pay feed bill","Clean water tanks","Order egg cartons","Mend fence","Register kid tags","Buy hoof trimmers","CDT boosters",
  ].map((t, i) => ({ title: t, category: "general", due_date: daysAgo(10 + i * 3), completed: true, completed_at: daysAgoTs(9 + i * 3) }));
  db.tasks = [
    ...openTasks.map((t) => ({ id: id("t"), completed: false, completed_at: null, notes: null, link_type: null, link_id: null, created_by: DEMO_USER_ID, created_at: now, updated_at: now, ...t })),
    ...doneTasks.map((t) => ({ id: id("t"), notes: null, link_type: null, link_id: null, created_by: DEMO_USER_ID, created_at: now, updated_at: now, ...t })),
  ];

  // ── Bills ───────────────────────────────────────────────────────────
  db.bills = [
    { name: "Electric — barn", category: "utilities", amount_cents: 8400, due_date: daysFromNow(9), paid: false, recurring: "monthly" },
    { name: "Well pump service", category: "maintenance", amount_cents: 27500, due_date: daysFromNow(15), paid: false, recurring: "none" },
    { name: "Feed bill — Co-op", category: "feed", amount_cents: 32000, due_date: daysFromNow(4), paid: false, recurring: "monthly" },
    { name: "Vet — annual", category: "vet", amount_cents: 18500, due_date: daysAgo(20), paid: true, paid_on: daysAgo(18), recurring: "annual" },
    { name: "Hay delivery", category: "feed", amount_cents: 42000, due_date: daysAgo(45), paid: true, paid_on: daysAgo(45), recurring: "none" },
    { name: "Electric — barn", category: "utilities", amount_cents: 7900, due_date: daysAgo(30), paid: true, paid_on: daysAgo(28), recurring: "monthly" },
    { name: "Fence repair supplies", category: "maintenance", amount_cents: 15600, due_date: daysAgo(60), paid: true, paid_on: daysAgo(60), recurring: "none" },
    { name: "Propane", category: "utilities", amount_cents: 21000, due_date: daysAgo(90), paid: true, paid_on: daysAgo(88), recurring: "quarterly" },
  ].map((b) => ({ id: id("b"), notes: null, paid_on: null, created_by: DEMO_USER_ID, created_at: now, updated_at: now, ...b }));

  // ── Income ─────────────────────────────────────────────────────────
  const income: Row[] = [];
  for (let w = 0; w < 24; w++) {
    income.push({ id: id("in"), source: "Farmers market", category: "eggs", amount_cents: Math.floor(rnd(1800, 4200)), entry_date: daysAgo(w * 7 + 2), link_type: null, link_id: null, notes: `Week ${24 - w} sales`, created_by: DEMO_USER_ID, created_at: now, recurring: false });
  }
  income.push(
    { id: id("in"), source: "Neighbor sale", category: "livestock", amount_cents: 40000, entry_date: daysAgo(21), link_type: "animal", link_id: kid1.id, notes: "Weaned kid deposit", created_by: DEMO_USER_ID, created_at: now, recurring: false },
    { id: id("in"), source: "Stud fee — Atlas", category: "breeding", amount_cents: 15000, entry_date: daysAgo(75), link_type: "animal", link_id: atlas.id, notes: null, created_by: DEMO_USER_ID, created_at: now, recurring: false },
    { id: id("in"), source: "Milk share", category: "dairy", amount_cents: 12000, entry_date: daysAgo(14), link_type: null, link_id: null, notes: "Monthly share", created_by: DEMO_USER_ID, created_at: now, recurring: true },
  );
  db.income_entries = income;

  // ── Contacts ────────────────────────────────────────────────────────
  db.contacts = [
    { id: id("co"), name: "Dr. Amelia Reyes", role: "vet", phone: "555-0142", email: "vet@ridgeanimal.com", location: "Ridge Animal Clinic", notes: "Large animal, on-call weekends", created_by: DEMO_USER_ID, created_at: now, updated_at: now },
    { id: id("co"), name: "Miller Family Farm", role: "feed", phone: "555-0177", email: null, location: "Rte 4", notes: "Alfalfa hay, spring & fall cuttings", created_by: DEMO_USER_ID, created_at: now, updated_at: now },
    { id: id("co"), name: "Jake Doherty", role: "neighbor", phone: "555-0199", email: null, location: "Across the road", notes: "Helps with butcher day", created_by: DEMO_USER_ID, created_at: now, updated_at: now },
  ];

  // ── Compost, garden, incubations ────────────────────────────────────
  db.compost_entries = [];
  for (let w = 0; w < 12; w++) {
    db.compost_entries.push({ id: id("cp"), material: pick(["straw","goat manure","kitchen scraps","chicken litter"]), quantity: rnd(20, 80), unit: "lb", added_on: daysAgo(w * 7 + 1), pile: pick(["Pile A","Pile B"]), notes: null, created_by: DEMO_USER_ID, created_at: now });
  }
  db.garden_plots = [
    { id: id("gp"), name: "Bed 1 — Tomatoes", size_sqft: 60, current_crop: "Cherokee Purple", planted_on: daysAgo(45), notes: "Trellised", created_by: DEMO_USER_ID, created_at: now, updated_at: now },
    { id: id("gp"), name: "Bed 2 — Greens", size_sqft: 40, current_crop: "Lettuce mix", planted_on: daysAgo(25), created_by: DEMO_USER_ID, created_at: now, updated_at: now },
    { id: id("gp"), name: "Bed 3 — Squash", size_sqft: 80, current_crop: "Butternut", planted_on: daysAgo(35), created_by: DEMO_USER_ID, created_at: now, updated_at: now },
    { id: id("gp"), name: "Bed 4 — Beans", size_sqft: 50, current_crop: "Pole beans", planted_on: daysAgo(30), created_by: DEMO_USER_ID, created_at: now, updated_at: now },
  ];
  db.incubations = [
    { id: id("ic"), species: "duck", egg_count: 12, started_on: daysAgo(21), expected_hatch: daysFromNow(7), status: "active", notes: "Pekin cross", created_by: DEMO_USER_ID, created_at: now, updated_at: now },
    { id: id("ic"), species: "chicken", egg_count: 18, started_on: daysAgo(60), expected_hatch: daysAgo(39), status: "completed", hatched_count: 15, notes: "Great hatch rate", created_by: DEMO_USER_ID, created_at: now, updated_at: now },
  ];

  // ── Empty defaults for tables the UI reads ──────────────────────────
  db.animal_events = [];
  db.heat_events = [];
  db.breeding_decisions = [];
  db.barter_contacts = [];
  db.barter_items = [];
  db.barter_deals = [];
  db.reminders = [];
  db.backups = [];
  db.role_permissions = [];
  db.species_catalog = [
    { id: id("sp"), name: "goat", gestation_days: 150, weaning_days: 84 },
    { id: id("sp"), name: "pig", gestation_days: 114, weaning_days: 56 },
    { id: id("sp"), name: "chicken", gestation_days: 21, weaning_days: null },
    { id: id("sp"), name: "duck", gestation_days: 28, weaning_days: null },
    { id: id("sp"), name: "dog", gestation_days: 63, weaning_days: 56 },
    { id: id("sp"), name: "cat", gestation_days: 65, weaning_days: 56 },
    { id: id("sp"), name: "rabbit", gestation_days: 31, weaning_days: 42 },
  ];
  db.breeds_catalog = [];

  return db;
}
