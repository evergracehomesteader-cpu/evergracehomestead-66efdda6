import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tag } from "lucide-react";

/**
 * "For Sale" controls on an animal's page.
 *
 * Turning the switch on publishes this animal to the Evergrace Homestead
 * website's Animals for Sale page (via the public for_sale_listings view,
 * which exposes only buyer-safe fields: name, species, breed, sex, birth
 * date, front photo, price, and the public sale description written here).
 * The animal's private notes, health records, and costs are never exposed.
 */

type AnimalSaleFields = {
  id: string;
  status: string;
  for_sale?: boolean | null;
  listing_price_cents?: number | null;
  sale_notes?: string | null;
  sale_listed_at?: string | null;
  front_photo_url?: string | null;
  photo_url?: string | null;
};

export function ForSaleCard({
  animal,
  onUpdate,
}: {
  animal: AnimalSaleFields;
  onUpdate: (patch: Record<string, unknown>) => void;
}) {
  const [on, setOn] = useState(!!animal.for_sale);
  const [price, setPrice] = useState(
    animal.listing_price_cents != null ? String(animal.listing_price_cents / 100) : "",
  );
  const [notes, setNotes] = useState(animal.sale_notes ?? "");
  const [dirty, setDirty] = useState(false);

  // Keep the form in sync when a different animal (or fresh data) loads.
  useEffect(() => {
    setOn(!!animal.for_sale);
    setPrice(animal.listing_price_cents != null ? String(animal.listing_price_cents / 100) : "");
    setNotes(animal.sale_notes ?? "");
    setDirty(false);
  }, [animal.id, animal.for_sale, animal.listing_price_cents, animal.sale_notes]);

  const hasPhoto = !!(animal.front_photo_url ?? animal.photo_url);
  const isActive = animal.status === "active";

  const save = () => {
    const dollars = parseFloat(price);
    const patch: Record<string, unknown> = {
      for_sale: on,
      listing_price_cents: Number.isFinite(dollars) && dollars >= 0 ? Math.round(dollars * 100) : null,
      sale_notes: notes.trim() ? notes.trim() : null,
    };
    if (on && !animal.for_sale) patch.sale_listed_at = new Date().toISOString();
    if (!on) patch.sale_listed_at = null;
    onUpdate(patch);
    setDirty(false);
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Tag className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">For sale on the website</h2>
        </div>
        <Switch
          checked={on}
          onCheckedChange={(v) => {
            setOn(v);
            setDirty(true);
          }}
          aria-label="List this animal for sale on the website"
        />
      </div>

      {on ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="sale-price">Price (USD)</Label>
            <Input
              id="sale-price"
              inputMode="decimal"
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 250"
              value={price}
              onChange={(e) => {
                setPrice(e.target.value);
                setDirty(true);
              }}
            />
            <p className="text-xs text-muted-foreground">Leave blank to show "Contact for price".</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sale-notes">Public description (what buyers see)</Label>
            <Textarea
              id="sale-notes"
              rows={3}
              placeholder="e.g. Registered Nigerian Dwarf doe, friendly, from good milking lines. UTD on CDT."
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setDirty(true);
              }}
            />
            <p className="text-xs text-muted-foreground">
              Only this description, the name, breed, sex, age, photo, and price appear on the website.
              Your private notes and records never leave the app.
            </p>
          </div>
          {!hasPhoto && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Tip: this animal has no front photo yet — listings with a photo get much more interest.
            </p>
          )}
          {!isActive && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              This animal's status is "{animal.status}" — it will only appear on the website while its
              status is active.
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Turn this on to list {`this animal`} on the Evergrace Homestead website with a price and a
          short public description.
        </p>
      )}

      {dirty && (
        <Button onClick={save} className="w-full sm:w-auto">
          {on ? "Save & publish listing" : "Save changes"}
        </Button>
      )}
      {on && !dirty && animal.sale_listed_at && (
        <p className="text-xs text-muted-foreground">
          Live on the website since{" "}
          {new Date(animal.sale_listed_at).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
          .
        </p>
      )}
    </Card>
  );
}
