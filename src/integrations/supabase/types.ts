export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      animal_events: {
        Row: {
          animal_id: string
          created_at: string
          created_by: string | null
          details: Json | null
          event_date: string
          event_type: string
          id: string
          title: string
        }
        Insert: {
          animal_id: string
          created_at?: string
          created_by?: string | null
          details?: Json | null
          event_date?: string
          event_type: string
          id?: string
          title: string
        }
        Update: {
          animal_id?: string
          created_at?: string
          created_by?: string | null
          details?: Json | null
          event_date?: string
          event_type?: string
          id?: string
          title?: string
        }
        Relationships: []
      }
      animals: {
        Row: {
          additional_photo_urls: string[]
          auto_marking_description: string | null
          breed: string | null
          breed_notes: string | null
          breed_percentage: string | null
          breed_type: string
          castration_date: string | null
          created_at: string
          created_by: string | null
          current_pen: string | null
          date_of_birth: string | null
          expected_sale_price_cents: number
          father_id: string | null
          front_photo_url: string | null
          id: string
          is_intact_male: string
          life_stage: string | null
          litter_id: string | null
          male_reproductive_status: string
          manual_life_stage_override: boolean
          medical_notes: string | null
          mother_id: string | null
          name: string
          notes: string | null
          ownership: string
          photo_url: string | null
          purchase_cost_cents: number
          purchase_date: string | null
          sale_date: string | null
          sale_price_cents: number
          secondary_breed: string | null
          sex: Database["public"]["Enums"]["animal_sex"]
          side_photo_url: string | null
          species: string
          status: Database["public"]["Enums"]["animal_status"]
          tag: string | null
          temperament_tags: string[]
          temporary_record: boolean
          testicle_status_notes: string | null
          updated_at: string
          user_edited_description: string | null
        }
        Insert: {
          additional_photo_urls?: string[]
          auto_marking_description?: string | null
          breed?: string | null
          breed_notes?: string | null
          breed_percentage?: string | null
          breed_type?: string
          castration_date?: string | null
          created_at?: string
          created_by?: string | null
          current_pen?: string | null
          date_of_birth?: string | null
          expected_sale_price_cents?: number
          father_id?: string | null
          front_photo_url?: string | null
          id?: string
          is_intact_male?: string
          life_stage?: string | null
          litter_id?: string | null
          male_reproductive_status?: string
          manual_life_stage_override?: boolean
          medical_notes?: string | null
          mother_id?: string | null
          name: string
          notes?: string | null
          ownership?: string
          photo_url?: string | null
          purchase_cost_cents?: number
          purchase_date?: string | null
          sale_date?: string | null
          sale_price_cents?: number
          secondary_breed?: string | null
          sex?: Database["public"]["Enums"]["animal_sex"]
          side_photo_url?: string | null
          species: string
          status?: Database["public"]["Enums"]["animal_status"]
          tag?: string | null
          temperament_tags?: string[]
          temporary_record?: boolean
          testicle_status_notes?: string | null
          updated_at?: string
          user_edited_description?: string | null
        }
        Update: {
          additional_photo_urls?: string[]
          auto_marking_description?: string | null
          breed?: string | null
          breed_notes?: string | null
          breed_percentage?: string | null
          breed_type?: string
          castration_date?: string | null
          created_at?: string
          created_by?: string | null
          current_pen?: string | null
          date_of_birth?: string | null
          expected_sale_price_cents?: number
          father_id?: string | null
          front_photo_url?: string | null
          id?: string
          is_intact_male?: string
          life_stage?: string | null
          litter_id?: string | null
          male_reproductive_status?: string
          manual_life_stage_override?: boolean
          medical_notes?: string | null
          mother_id?: string | null
          name?: string
          notes?: string | null
          ownership?: string
          photo_url?: string | null
          purchase_cost_cents?: number
          purchase_date?: string | null
          sale_date?: string | null
          sale_price_cents?: number
          secondary_breed?: string | null
          sex?: Database["public"]["Enums"]["animal_sex"]
          side_photo_url?: string | null
          species?: string
          status?: Database["public"]["Enums"]["animal_status"]
          tag?: string | null
          temperament_tags?: string[]
          temporary_record?: boolean
          testicle_status_notes?: string | null
          updated_at?: string
          user_edited_description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "animals_father_id_fkey"
            columns: ["father_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animals_mother_id_fkey"
            columns: ["mother_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
        ]
      }
      backups: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          label: string
          notes: string | null
          size_bytes: number
          storage_path: string
          table_counts: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          notes?: string | null
          size_bytes?: number
          storage_path: string
          table_counts?: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          notes?: string | null
          size_bytes?: number
          storage_path?: string
          table_counts?: Json
        }
        Relationships: []
      }
      barter_contacts: {
        Row: {
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          location: string | null
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      barter_deals: {
        Row: {
          category: Database["public"]["Enums"]["barter_category"]
          contact_id: string | null
          contact_info: string | null
          created_at: string
          created_by: string | null
          due_date: string | null
          estimated_value_cents: number
          given_summary: string | null
          id: string
          location: string | null
          notes: string | null
          person_name: string | null
          photo_urls: string[]
          received_summary: string | null
          status: Database["public"]["Enums"]["barter_status"]
          tags: string[]
          title: string
          trade_date: string | null
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["barter_category"]
          contact_id?: string | null
          contact_info?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          estimated_value_cents?: number
          given_summary?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          person_name?: string | null
          photo_urls?: string[]
          received_summary?: string | null
          status?: Database["public"]["Enums"]["barter_status"]
          tags?: string[]
          title: string
          trade_date?: string | null
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["barter_category"]
          contact_id?: string | null
          contact_info?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          estimated_value_cents?: number
          given_summary?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          person_name?: string | null
          photo_urls?: string[]
          received_summary?: string | null
          status?: Database["public"]["Enums"]["barter_status"]
          tags?: string[]
          title?: string
          trade_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "barter_deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "barter_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      barter_items: {
        Row: {
          created_at: string
          deal_id: string
          description: string
          direction: Database["public"]["Enums"]["barter_direction"]
          id: string
          link_id: string | null
          link_type: Database["public"]["Enums"]["barter_link_type"]
          quantity: number | null
          unit: string | null
          value_cents: number | null
        }
        Insert: {
          created_at?: string
          deal_id: string
          description: string
          direction: Database["public"]["Enums"]["barter_direction"]
          id?: string
          link_id?: string | null
          link_type?: Database["public"]["Enums"]["barter_link_type"]
          quantity?: number | null
          unit?: string | null
          value_cents?: number | null
        }
        Update: {
          created_at?: string
          deal_id?: string
          description?: string
          direction?: Database["public"]["Enums"]["barter_direction"]
          id?: string
          link_id?: string | null
          link_type?: Database["public"]["Enums"]["barter_link_type"]
          quantity?: number | null
          unit?: string | null
          value_cents?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "barter_items_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "barter_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          amount_cents: number
          category: string | null
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          name: string
          notes: string | null
          paid: boolean
          paid_on: string | null
          recurring: string
          updated_at: string
        }
        Insert: {
          amount_cents?: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          name: string
          notes?: string | null
          paid?: boolean
          paid_on?: string | null
          recurring?: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          paid?: boolean
          paid_on?: string | null
          recurring?: string
          updated_at?: string
        }
        Relationships: []
      }
      breeding_decisions: {
        Row: {
          animal_id: string
          created_at: string
          created_by: string | null
          decision: string
          id: string
          reason: string | null
          target_date: string | null
          updated_at: string
        }
        Insert: {
          animal_id: string
          created_at?: string
          created_by?: string | null
          decision?: string
          id?: string
          reason?: string | null
          target_date?: string | null
          updated_at?: string
        }
        Update: {
          animal_id?: string
          created_at?: string
          created_by?: string | null
          decision?: string
          id?: string
          reason?: string | null
          target_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      breeds_catalog: {
        Row: {
          breed_name: string
          created_at: string
          created_by: string | null
          id: string
          is_custom: boolean
          species_id: string
        }
        Insert: {
          breed_name: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_custom?: boolean
          species_id: string
        }
        Update: {
          breed_name?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_custom?: boolean
          species_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "breeds_catalog_species_id_fkey"
            columns: ["species_id"]
            isOneToOne: false
            referencedRelation: "species_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      chore_assignments: {
        Row: {
          chore_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          chore_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          chore_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chore_assignments_chore_id_fkey"
            columns: ["chore_id"]
            isOneToOne: false
            referencedRelation: "chores"
            referencedColumns: ["id"]
          },
        ]
      }
      chore_completions: {
        Row: {
          chore_id: string
          completed_at: string
          completed_by: string | null
          id: string
          instance_date: string
          notes: string | null
        }
        Insert: {
          chore_id: string
          completed_at?: string
          completed_by?: string | null
          id?: string
          instance_date: string
          notes?: string | null
        }
        Update: {
          chore_id?: string
          completed_at?: string
          completed_by?: string | null
          id?: string
          instance_date?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chore_completions_chore_id_fkey"
            columns: ["chore_id"]
            isOneToOne: false
            referencedRelation: "chores"
            referencedColumns: ["id"]
          },
        ]
      }
      chores: {
        Row: {
          active: boolean
          category: string
          created_at: string
          created_by: string | null
          day_of_month: number | null
          days_of_week: number[]
          due_time: string | null
          end_date: string | null
          id: string
          notes: string | null
          recurrence: string
          start_date: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string
          created_at?: string
          created_by?: string | null
          day_of_month?: number | null
          days_of_week?: number[]
          due_time?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          recurrence?: string
          start_date?: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          created_by?: string | null
          day_of_month?: number | null
          days_of_week?: number[]
          due_time?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          recurrence?: string
          start_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      compost_entries: {
        Row: {
          created_at: string
          created_by: string | null
          entry_date: string
          entry_type: string
          id: string
          material: string | null
          notes: string | null
          quantity: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entry_date?: string
          entry_type?: string
          id?: string
          material?: string | null
          notes?: string | null
          quantity?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entry_date?: string
          entry_type?: string
          id?: string
          material?: string | null
          notes?: string | null
          quantity?: string | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          location: string | null
          name: string
          notes: string | null
          phone: string | null
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      feed_container_stock: {
        Row: {
          container_id: string
          feed_item_id: string
          id: string
          stock_lbs: number
          updated_at: string
        }
        Insert: {
          container_id: string
          feed_item_id: string
          id?: string
          stock_lbs?: number
          updated_at?: string
        }
        Update: {
          container_id?: string
          feed_item_id?: string
          id?: string
          stock_lbs?: number
          updated_at?: string
        }
        Relationships: []
      }
      feed_containers: {
        Row: {
          active: boolean
          capacity_lbs: number | null
          created_at: string
          created_by: string | null
          id: string
          location: string | null
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          capacity_lbs?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          capacity_lbs?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      feed_items: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          low_stock_threshold: number
          name: string
          notes: string | null
          package_size: number | null
          price_cents: number | null
          species_for: string | null
          stock_qty: number
          store: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          low_stock_threshold?: number
          name: string
          notes?: string | null
          package_size?: number | null
          price_cents?: number | null
          species_for?: string | null
          stock_qty?: number
          store?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          low_stock_threshold?: number
          name?: string
          notes?: string | null
          package_size?: number | null
          price_cents?: number | null
          species_for?: string | null
          stock_qty?: number
          store?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      feed_logs: {
        Row: {
          animal_id: string | null
          container_id: string | null
          created_at: string
          created_by: string | null
          fed_on: string
          feed_item_id: string
          id: string
          notes: string | null
          quantity: number
          target_type: string
          target_value: string | null
          total_lbs: number
          unit_id: string | null
          unit_qty: number | null
        }
        Insert: {
          animal_id?: string | null
          container_id?: string | null
          created_at?: string
          created_by?: string | null
          fed_on?: string
          feed_item_id: string
          id?: string
          notes?: string | null
          quantity: number
          target_type?: string
          target_value?: string | null
          total_lbs?: number
          unit_id?: string | null
          unit_qty?: number | null
        }
        Update: {
          animal_id?: string | null
          container_id?: string | null
          created_at?: string
          created_by?: string | null
          fed_on?: string
          feed_item_id?: string
          id?: string
          notes?: string | null
          quantity?: number
          target_type?: string
          target_value?: string | null
          total_lbs?: number
          unit_id?: string | null
          unit_qty?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "feed_logs_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_logs_feed_item_id_fkey"
            columns: ["feed_item_id"]
            isOneToOne: false
            referencedRelation: "feed_items"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_purchases: {
        Row: {
          bag_count: number | null
          bag_size_lbs: number | null
          container_id: string | null
          cost_per_bag_cents: number | null
          created_at: string
          created_by: string | null
          custom_unit_id: string | null
          custom_unit_qty: number | null
          feed_item_id: string
          id: string
          notes: string | null
          price_cents: number
          purchased_on: string
          quantity: number
          store: string | null
          total_lbs: number
          unit_type: string
        }
        Insert: {
          bag_count?: number | null
          bag_size_lbs?: number | null
          container_id?: string | null
          cost_per_bag_cents?: number | null
          created_at?: string
          created_by?: string | null
          custom_unit_id?: string | null
          custom_unit_qty?: number | null
          feed_item_id: string
          id?: string
          notes?: string | null
          price_cents: number
          purchased_on?: string
          quantity: number
          store?: string | null
          total_lbs?: number
          unit_type?: string
        }
        Update: {
          bag_count?: number | null
          bag_size_lbs?: number | null
          container_id?: string | null
          cost_per_bag_cents?: number | null
          created_at?: string
          created_by?: string | null
          custom_unit_id?: string | null
          custom_unit_qty?: number | null
          feed_item_id?: string
          id?: string
          notes?: string | null
          price_cents?: number
          purchased_on?: string
          quantity?: number
          store?: string | null
          total_lbs?: number
          unit_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_purchases_feed_item_id_fkey"
            columns: ["feed_item_id"]
            isOneToOne: false
            referencedRelation: "feed_items"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_units: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_system: boolean
          lbs_per_unit: number
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_system?: boolean
          lbs_per_unit?: number
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_system?: boolean
          lbs_per_unit?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      garden_plots: {
        Row: {
          created_at: string
          created_by: string | null
          crop: string | null
          expected_harvest: string | null
          id: string
          last_watered_on: string | null
          name: string
          notes: string | null
          planted_on: string | null
          status: string
          updated_at: string
          watering_interval_days: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          crop?: string | null
          expected_harvest?: string | null
          id?: string
          last_watered_on?: string | null
          name: string
          notes?: string | null
          planted_on?: string | null
          status?: string
          updated_at?: string
          watering_interval_days?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          crop?: string | null
          expected_harvest?: string | null
          id?: string
          last_watered_on?: string | null
          name?: string
          notes?: string | null
          planted_on?: string | null
          status?: string
          updated_at?: string
          watering_interval_days?: number | null
        }
        Relationships: []
      }
      health_records: {
        Row: {
          administered_on: string
          animal_id: string
          body_condition_score: number | null
          contact_id: string | null
          cost_cents: number
          created_at: string
          created_by: string | null
          dosage: string | null
          id: string
          notes: string | null
          product: string | null
          record_type: string
          updated_at: string
          vet_contact: string | null
          withdrawal_eggs_until: string | null
          withdrawal_meat_until: string | null
          withdrawal_milk_until: string | null
        }
        Insert: {
          administered_on?: string
          animal_id: string
          body_condition_score?: number | null
          contact_id?: string | null
          cost_cents?: number
          created_at?: string
          created_by?: string | null
          dosage?: string | null
          id?: string
          notes?: string | null
          product?: string | null
          record_type?: string
          updated_at?: string
          vet_contact?: string | null
          withdrawal_eggs_until?: string | null
          withdrawal_meat_until?: string | null
          withdrawal_milk_until?: string | null
        }
        Update: {
          administered_on?: string
          animal_id?: string
          body_condition_score?: number | null
          contact_id?: string | null
          cost_cents?: number
          created_at?: string
          created_by?: string | null
          dosage?: string | null
          id?: string
          notes?: string | null
          product?: string | null
          record_type?: string
          updated_at?: string
          vet_contact?: string | null
          withdrawal_eggs_until?: string | null
          withdrawal_meat_until?: string | null
          withdrawal_milk_until?: string | null
        }
        Relationships: []
      }
      heat_events: {
        Row: {
          animal_id: string
          created_at: string
          created_by: string | null
          event_date: string
          id: string
          notes: string | null
        }
        Insert: {
          animal_id: string
          created_at?: string
          created_by?: string | null
          event_date: string
          id?: string
          notes?: string | null
        }
        Update: {
          animal_id?: string
          created_at?: string
          created_by?: string | null
          event_date?: string
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "heat_events_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
        ]
      }
      income_entries: {
        Row: {
          amount_cents: number
          category: string
          created_at: string
          created_by: string | null
          entry_date: string
          id: string
          link_id: string | null
          link_type: string | null
          notes: string | null
          recurring: boolean
          source: string
        }
        Insert: {
          amount_cents?: number
          category?: string
          created_at?: string
          created_by?: string | null
          entry_date?: string
          id?: string
          link_id?: string | null
          link_type?: string | null
          notes?: string | null
          recurring?: boolean
          source: string
        }
        Update: {
          amount_cents?: number
          category?: string
          created_at?: string
          created_by?: string | null
          entry_date?: string
          id?: string
          link_id?: string | null
          link_type?: string | null
          notes?: string | null
          recurring?: boolean
          source?: string
        }
        Relationships: []
      }
      litters: {
        Row: {
          birth_date: string
          created_at: string
          created_by: string | null
          father_id: string | null
          female_count: number
          id: string
          male_count: number
          mother_id: string | null
          notes: string | null
          unknown_count: number
          updated_at: string
        }
        Insert: {
          birth_date?: string
          created_at?: string
          created_by?: string | null
          father_id?: string | null
          female_count?: number
          id?: string
          male_count?: number
          mother_id?: string | null
          notes?: string | null
          unknown_count?: number
          updated_at?: string
        }
        Update: {
          birth_date?: string
          created_at?: string
          created_by?: string | null
          father_id?: string | null
          female_count?: number
          id?: string
          male_count?: number
          mother_id?: string | null
          notes?: string | null
          unknown_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      pregnancies: {
        Row: {
          actual_birth: string | null
          animal_id: string
          bred_date: string
          breeding_cost_cents: number
          created_at: string
          created_by: string | null
          expected_due: string | null
          id: string
          notes: string | null
          offspring_count: number | null
          sire_id: string | null
          status: Database["public"]["Enums"]["pregnancy_status"]
          survived_count: number | null
          updated_at: string
        }
        Insert: {
          actual_birth?: string | null
          animal_id: string
          bred_date: string
          breeding_cost_cents?: number
          created_at?: string
          created_by?: string | null
          expected_due?: string | null
          id?: string
          notes?: string | null
          offspring_count?: number | null
          sire_id?: string | null
          status?: Database["public"]["Enums"]["pregnancy_status"]
          survived_count?: number | null
          updated_at?: string
        }
        Update: {
          actual_birth?: string | null
          animal_id?: string
          bred_date?: string
          breeding_cost_cents?: number
          created_at?: string
          created_by?: string | null
          expected_due?: string | null
          id?: string
          notes?: string | null
          offspring_count?: number | null
          sire_id?: string | null
          status?: Database["public"]["Enums"]["pregnancy_status"]
          survived_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pregnancies_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pregnancies_sire_id_fkey"
            columns: ["sire_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
        ]
      }
      production_logs: {
        Row: {
          animal_id: string | null
          created_at: string
          created_by: string | null
          group_label: string | null
          id: string
          notes: string | null
          produced_on: string
          product_type: string
          quantity: number
          unit: string
          value_cents: number
        }
        Insert: {
          animal_id?: string | null
          created_at?: string
          created_by?: string | null
          group_label?: string | null
          id?: string
          notes?: string | null
          produced_on?: string
          product_type: string
          quantity?: number
          unit?: string
          value_cents?: number
        }
        Update: {
          animal_id?: string | null
          created_at?: string
          created_by?: string | null
          group_label?: string | null
          id?: string
          notes?: string | null
          produced_on?: string
          product_type?: string
          quantity?: number
          unit?: string
          value_cents?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          display_name: string | null
          id: string
          notes: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_name?: string | null
          id: string
          notes?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          display_name?: string | null
          id?: string
          notes?: string | null
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          id?: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          id?: string
          permission?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      species_catalog: {
        Row: {
          adult_female_term: string | null
          adult_male_term: string | null
          baby_term: string | null
          baby_to_juvenile_age_months: number | null
          breeding_age_female_months: number | null
          breeding_age_male_months: number | null
          created_at: string
          female_with_babies_term: string | null
          gestation_days: number | null
          id: string
          juvenile_term: string | null
          juvenile_to_adult_age_months: number | null
          name: string
          updated_at: string
        }
        Insert: {
          adult_female_term?: string | null
          adult_male_term?: string | null
          baby_term?: string | null
          baby_to_juvenile_age_months?: number | null
          breeding_age_female_months?: number | null
          breeding_age_male_months?: number | null
          created_at?: string
          female_with_babies_term?: string | null
          gestation_days?: number | null
          id?: string
          juvenile_term?: string | null
          juvenile_to_adult_age_months?: number | null
          name: string
          updated_at?: string
        }
        Update: {
          adult_female_term?: string | null
          adult_male_term?: string | null
          baby_term?: string | null
          baby_to_juvenile_age_months?: number | null
          breeding_age_female_months?: number | null
          breeding_age_male_months?: number | null
          created_at?: string
          female_with_babies_term?: string | null
          gestation_days?: number | null
          id?: string
          juvenile_term?: string | null
          juvenile_to_adult_age_months?: number | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          category: string
          completed: boolean
          completed_at: string | null
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          link_id: string | null
          link_type: string | null
          notes: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          link_id?: string | null
          link_type?: string | null
          notes?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          link_id?: string | null
          link_type?: string | null
          notes?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      weight_logs: {
        Row: {
          animal_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          unit: string
          weighed_on: string
          weight: number
        }
        Insert: {
          animal_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          unit?: string
          weighed_on?: string
          weight: number
        }
        Update: {
          animal_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          unit?: string
          weighed_on?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "weight_logs_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      animal_sex: "female" | "male" | "unknown"
      animal_status:
        | "active"
        | "sold"
        | "deceased"
        | "archived"
        | "butchered"
        | "missing"
        | "breeding"
        | "pregnant"
        | "grow_out"
        | "retained"
        | "pending_sale"
        | "pending_trade"
        | "butcher_planned"
        | "medical_hold"
        | "quarantine"
        | "pet"
        | "retired"
      app_role:
        | "admin"
        | "manager"
        | "helper"
        | "viewer"
        | "bookkeeper"
        | "animal_care"
        | "volunteer"
        | "pending"
      barter_category:
        | "livestock"
        | "feed"
        | "equipment"
        | "labor"
        | "produce"
        | "building_materials"
        | "services"
        | "other"
      barter_direction: "given" | "received"
      barter_link_type:
        | "animal"
        | "feed"
        | "garden"
        | "equipment"
        | "service"
        | "other"
      barter_status: "pending" | "completed" | "cancelled"
      pregnancy_status:
        | "active"
        | "born"
        | "lost"
        | "suspected"
        | "confirmed"
        | "delivered"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      animal_sex: ["female", "male", "unknown"],
      animal_status: [
        "active",
        "sold",
        "deceased",
        "archived",
        "butchered",
        "missing",
        "breeding",
        "pregnant",
        "grow_out",
        "retained",
        "pending_sale",
        "pending_trade",
        "butcher_planned",
        "medical_hold",
        "quarantine",
        "pet",
        "retired",
      ],
      app_role: [
        "admin",
        "manager",
        "helper",
        "viewer",
        "bookkeeper",
        "animal_care",
        "volunteer",
        "pending",
      ],
      barter_category: [
        "livestock",
        "feed",
        "equipment",
        "labor",
        "produce",
        "building_materials",
        "services",
        "other",
      ],
      barter_direction: ["given", "received"],
      barter_link_type: [
        "animal",
        "feed",
        "garden",
        "equipment",
        "service",
        "other",
      ],
      barter_status: ["pending", "completed", "cancelled"],
      pregnancy_status: [
        "active",
        "born",
        "lost",
        "suspected",
        "confirmed",
        "delivered",
      ],
    },
  },
} as const
