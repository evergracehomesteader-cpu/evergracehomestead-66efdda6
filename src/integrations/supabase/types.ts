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
          homestead_id: string
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
          homestead_id?: string
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
          homestead_id?: string
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "animal_events_homestead_id_fkey"
            columns: ["homestead_id"]
            isOneToOne: false
            referencedRelation: "homesteads"
            referencedColumns: ["id"]
          },
        ]
      }
      animals: {
        Row: {
          additional_photo_urls: string[]
          auto_marking_description: string | null
          breed: string | null
          breed_notes: string | null
          breed_percentage: string | null
          breed_type: string
          breeding_status: string | null
          castration_date: string | null
          created_at: string
          created_by: string | null
          current_pen: string | null
          date_of_birth: string | null
          expected_sale_price_cents: number
          father_id: string | null
          front_photo_url: string | null
          homestead_id: string
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
          nursing_started_at: string | null
          ownership: string
          photo_url: string | null
          purchase_cost_cents: number
          purchase_date: string | null
          recovery_complete_at: string | null
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
          weaning_due: string | null
        }
        Insert: {
          additional_photo_urls?: string[]
          auto_marking_description?: string | null
          breed?: string | null
          breed_notes?: string | null
          breed_percentage?: string | null
          breed_type?: string
          breeding_status?: string | null
          castration_date?: string | null
          created_at?: string
          created_by?: string | null
          current_pen?: string | null
          date_of_birth?: string | null
          expected_sale_price_cents?: number
          father_id?: string | null
          front_photo_url?: string | null
          homestead_id?: string
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
          nursing_started_at?: string | null
          ownership?: string
          photo_url?: string | null
          purchase_cost_cents?: number
          purchase_date?: string | null
          recovery_complete_at?: string | null
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
          weaning_due?: string | null
        }
        Update: {
          additional_photo_urls?: string[]
          auto_marking_description?: string | null
          breed?: string | null
          breed_notes?: string | null
          breed_percentage?: string | null
          breed_type?: string
          breeding_status?: string | null
          castration_date?: string | null
          created_at?: string
          created_by?: string | null
          current_pen?: string | null
          date_of_birth?: string | null
          expected_sale_price_cents?: number
          father_id?: string | null
          front_photo_url?: string | null
          homestead_id?: string
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
          nursing_started_at?: string | null
          ownership?: string
          photo_url?: string | null
          purchase_cost_cents?: number
          purchase_date?: string | null
          recovery_complete_at?: string | null
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
          weaning_due?: string | null
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
            foreignKeyName: "animals_homestead_id_fkey"
            columns: ["homestead_id"]
            isOneToOne: false
            referencedRelation: "homesteads"
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
          homestead_id: string
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
          homestead_id?: string
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
          homestead_id?: string
          id?: string
          label?: string
          notes?: string | null
          size_bytes?: number
          storage_path?: string
          table_counts?: Json
        }
        Relationships: [
          {
            foreignKeyName: "backups_homestead_id_fkey"
            columns: ["homestead_id"]
            isOneToOne: false
            referencedRelation: "homesteads"
            referencedColumns: ["id"]
          },
        ]
      }
      barter_contacts: {
        Row: {
          created_at: string
          created_by: string | null
          email: string | null
          homestead_id: string
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
          homestead_id?: string
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
          homestead_id?: string
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "barter_contacts_homestead_id_fkey"
            columns: ["homestead_id"]
            isOneToOne: false
            referencedRelation: "homesteads"
            referencedColumns: ["id"]
          },
        ]
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
          homestead_id: string
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
          homestead_id?: string
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
          homestead_id?: string
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
          {
            foreignKeyName: "barter_deals_homestead_id_fkey"
            columns: ["homestead_id"]
            isOneToOne: false
            referencedRelation: "homesteads"
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
          homestead_id: string
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
          homestead_id?: string
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
          homestead_id?: string
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
          {
            foreignKeyName: "barter_items_homestead_id_fkey"
            columns: ["homestead_id"]
            isOneToOne: false
            referencedRelation: "homesteads"
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
          homestead_id: string
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
          homestead_id?: string
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
          homestead_id?: string
          id?: string
          name?: string
          notes?: string | null
          paid?: boolean
          paid_on?: string | null
          recurring?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bills_homestead_id_fkey"
            columns: ["homestead_id"]
            isOneToOne: false
            referencedRelation: "homesteads"
            referencedColumns: ["id"]
          },
        ]
      }
      breeding_decisions: {
        Row: {
          animal_id: string
          created_at: string
          created_by: string | null
          decision: string
          homestead_id: string
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
          homestead_id?: string
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
          homestead_id?: string
          id?: string
          reason?: string | null
          target_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "breeding_decisions_homestead_id_fkey"
            columns: ["homestead_id"]
            isOneToOne: false
            referencedRelation: "homesteads"
            referencedColumns: ["id"]
          },
        ]
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
          homestead_id: string
          id: string
          user_id: string
        }
        Insert: {
          chore_id: string
          created_at?: string
          homestead_id?: string
          id?: string
          user_id: string
        }
        Update: {
          chore_id?: string
          created_at?: string
          homestead_id?: string
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
          {
            foreignKeyName: "chore_assignments_homestead_id_fkey"
            columns: ["homestead_id"]
            isOneToOne: false
            referencedRelation: "homesteads"
            referencedColumns: ["id"]
          },
        ]
      }
      chore_completions: {
        Row: {
          chore_id: string
          completed_at: string
          completed_by: string | null
          homestead_id: string
          id: string
          instance_date: string
          notes: string | null
        }
        Insert: {
          chore_id: string
          completed_at?: string
          completed_by?: string | null
          homestead_id?: string
          id?: string
          instance_date: string
          notes?: string | null
        }
        Update: {
          chore_id?: string
          completed_at?: string
          completed_by?: string | null
          homestead_id?: string
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
          {
            foreignKeyName: "chore_completions_homestead_id_fkey"
            columns: ["homestead_id"]
            isOneToOne: false
            referencedRelation: "homesteads"
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
          homestead_id: string
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
          homestead_id?: string
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
          homestead_id?: string
          id?: string
          notes?: string | null
          recurrence?: string
          start_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chores_homestead_id_fkey"
            columns: ["homestead_id"]
            isOneToOne: false
            referencedRelation: "homesteads"
            referencedColumns: ["id"]
          },
        ]
      }
      compost_entries: {
        Row: {
          created_at: string
          created_by: string | null
          entry_date: string
          entry_type: string
          homestead_id: string
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
          homestead_id?: string
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
          homestead_id?: string
          id?: string
          material?: string | null
          notes?: string | null
          quantity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compost_entries_homestead_id_fkey"
            columns: ["homestead_id"]
            isOneToOne: false
            referencedRelation: "homesteads"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          created_by: string | null
          email: string | null
          homestead_id: string
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
          homestead_id?: string
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
          homestead_id?: string
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_homestead_id_fkey"
            columns: ["homestead_id"]
            isOneToOne: false
            referencedRelation: "homesteads"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_container_stock: {
        Row: {
          container_id: string
          feed_item_id: string
          homestead_id: string
          id: string
          stock_lbs: number
          updated_at: string
        }
        Insert: {
          container_id: string
          feed_item_id: string
          homestead_id?: string
          id?: string
          stock_lbs?: number
          updated_at?: string
        }
        Update: {
          container_id?: string
          feed_item_id?: string
          homestead_id?: string
          id?: string
          stock_lbs?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_container_stock_homestead_id_fkey"
            columns: ["homestead_id"]
            isOneToOne: false
            referencedRelation: "homesteads"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_containers: {
        Row: {
          active: boolean
          capacity_lbs: number | null
          created_at: string
          created_by: string | null
          homestead_id: string
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
          homestead_id?: string
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
          homestead_id?: string
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_containers_homestead_id_fkey"
            columns: ["homestead_id"]
            isOneToOne: false
            referencedRelation: "homesteads"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_items: {
        Row: {
          created_at: string
          created_by: string | null
          homestead_id: string
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
          homestead_id?: string
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
          homestead_id?: string
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
        Relationships: [
          {
            foreignKeyName: "feed_items_homestead_id_fkey"
            columns: ["homestead_id"]
            isOneToOne: false
            referencedRelation: "homesteads"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_logs: {
        Row: {
          animal_id: string | null
          container_id: string | null
          created_at: string
          created_by: string | null
          fed_on: string
          feed_item_id: string
          homestead_id: string
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
          homestead_id?: string
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
          homestead_id?: string
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
          {
            foreignKeyName: "feed_logs_homestead_id_fkey"
            columns: ["homestead_id"]
            isOneToOne: false
            referencedRelation: "homesteads"
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
          homestead_id: string
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
          homestead_id?: string
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
          homestead_id?: string
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
          {
            foreignKeyName: "feed_purchases_homestead_id_fkey"
            columns: ["homestead_id"]
            isOneToOne: false
            referencedRelation: "homesteads"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_units: {
        Row: {
          created_at: string
          created_by: string | null
          homestead_id: string
          id: string
          is_system: boolean
          lbs_per_unit: number
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          homestead_id?: string
          id?: string
          is_system?: boolean
          lbs_per_unit?: number
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          homestead_id?: string
          id?: string
          is_system?: boolean
          lbs_per_unit?: number
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_units_homestead_id_fkey"
            columns: ["homestead_id"]
            isOneToOne: false
            referencedRelation: "homesteads"
            referencedColumns: ["id"]
          },
        ]
      }
      garden_plots: {
        Row: {
          created_at: string
          created_by: string | null
          crop: string | null
          expected_harvest: string | null
          homestead_id: string
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
          homestead_id?: string
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
          homestead_id?: string
          id?: string
          last_watered_on?: string | null
          name?: string
          notes?: string | null
          planted_on?: string | null
          status?: string
          updated_at?: string
          watering_interval_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "garden_plots_homestead_id_fkey"
            columns: ["homestead_id"]
            isOneToOne: false
            referencedRelation: "homesteads"
            referencedColumns: ["id"]
          },
        ]
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
          homestead_id: string
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
          homestead_id?: string
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
          homestead_id?: string
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
        Relationships: [
          {
            foreignKeyName: "health_records_homestead_id_fkey"
            columns: ["homestead_id"]
            isOneToOne: false
            referencedRelation: "homesteads"
            referencedColumns: ["id"]
          },
        ]
      }
      heat_events: {
        Row: {
          animal_id: string
          created_at: string
          created_by: string | null
          event_date: string
          homestead_id: string
          id: string
          notes: string | null
        }
        Insert: {
          animal_id: string
          created_at?: string
          created_by?: string | null
          event_date: string
          homestead_id?: string
          id?: string
          notes?: string | null
        }
        Update: {
          animal_id?: string
          created_at?: string
          created_by?: string | null
          event_date?: string
          homestead_id?: string
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
          {
            foreignKeyName: "heat_events_homestead_id_fkey"
            columns: ["homestead_id"]
            isOneToOne: false
            referencedRelation: "homesteads"
            referencedColumns: ["id"]
          },
        ]
      }
      homestead_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          homestead_id: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          homestead_id: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          homestead_id?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "homestead_invitations_homestead_id_fkey"
            columns: ["homestead_id"]
            isOneToOne: false
            referencedRelation: "homesteads"
            referencedColumns: ["id"]
          },
        ]
      }
      homestead_members: {
        Row: {
          created_at: string
          homestead_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          homestead_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          homestead_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "homestead_members_homestead_id_fkey"
            columns: ["homestead_id"]
            isOneToOne: false
            referencedRelation: "homesteads"
            referencedColumns: ["id"]
          },
        ]
      }
      homesteads: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      income_entries: {
        Row: {
          amount_cents: number
          category: string
          created_at: string
          created_by: string | null
          entry_date: string
          homestead_id: string
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
          homestead_id?: string
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
          homestead_id?: string
          id?: string
          link_id?: string | null
          link_type?: string | null
          notes?: string | null
          recurring?: boolean
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "income_entries_homestead_id_fkey"
            columns: ["homestead_id"]
            isOneToOne: false
            referencedRelation: "homesteads"
            referencedColumns: ["id"]
          },
        ]
      }
      incubations: {
        Row: {
          actual_hatch: string | null
          animal_id: string | null
          created_at: string
          created_by: string | null
          egg_count: number
          expected_hatch: string | null
          fertile: boolean | null
          hatched_count: number | null
          homestead_id: string
          id: string
          notes: string | null
          set_date: string
          species: string
          updated_at: string
        }
        Insert: {
          actual_hatch?: string | null
          animal_id?: string | null
          created_at?: string
          created_by?: string | null
          egg_count?: number
          expected_hatch?: string | null
          fertile?: boolean | null
          hatched_count?: number | null
          homestead_id?: string
          id?: string
          notes?: string | null
          set_date?: string
          species: string
          updated_at?: string
        }
        Update: {
          actual_hatch?: string | null
          animal_id?: string | null
          created_at?: string
          created_by?: string | null
          egg_count?: number
          expected_hatch?: string | null
          fertile?: boolean | null
          hatched_count?: number | null
          homestead_id?: string
          id?: string
          notes?: string | null
          set_date?: string
          species?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incubations_homestead_id_fkey"
            columns: ["homestead_id"]
            isOneToOne: false
            referencedRelation: "homesteads"
            referencedColumns: ["id"]
          },
        ]
      }
      litters: {
        Row: {
          birth_date: string
          created_at: string
          created_by: string | null
          father_id: string | null
          female_count: number
          homestead_id: string
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
          homestead_id?: string
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
          homestead_id?: string
          id?: string
          male_count?: number
          mother_id?: string | null
          notes?: string | null
          unknown_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "litters_homestead_id_fkey"
            columns: ["homestead_id"]
            isOneToOne: false
            referencedRelation: "homesteads"
            referencedColumns: ["id"]
          },
        ]
      }
      pens: {
        Row: {
          active: boolean
          capacity: number | null
          created_at: string
          created_by: string | null
          homestead_id: string
          id: string
          location: string | null
          name: string
          notes: string | null
          species: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          capacity?: number | null
          created_at?: string
          created_by?: string | null
          homestead_id?: string
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          species?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          capacity?: number | null
          created_at?: string
          created_by?: string | null
          homestead_id?: string
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          species?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pens_homestead_id_fkey"
            columns: ["homestead_id"]
            isOneToOne: false
            referencedRelation: "homesteads"
            referencedColumns: ["id"]
          },
        ]
      }
      pregnancies: {
        Row: {
          actual_birth: string | null
          animal_id: string
          bred_date: string
          breeding_cost_cents: number
          breeding_method: string
          created_at: string
          created_by: string | null
          evidence: string | null
          expected_due: string | null
          female_born: number | null
          homestead_id: string
          id: string
          male_born: number | null
          notes: string | null
          offspring_count: number | null
          sire_id: string | null
          status: Database["public"]["Enums"]["pregnancy_status"]
          stillborn_count: number | null
          survived_count: number | null
          updated_at: string
        }
        Insert: {
          actual_birth?: string | null
          animal_id: string
          bred_date: string
          breeding_cost_cents?: number
          breeding_method?: string
          created_at?: string
          created_by?: string | null
          evidence?: string | null
          expected_due?: string | null
          female_born?: number | null
          homestead_id?: string
          id?: string
          male_born?: number | null
          notes?: string | null
          offspring_count?: number | null
          sire_id?: string | null
          status?: Database["public"]["Enums"]["pregnancy_status"]
          stillborn_count?: number | null
          survived_count?: number | null
          updated_at?: string
        }
        Update: {
          actual_birth?: string | null
          animal_id?: string
          bred_date?: string
          breeding_cost_cents?: number
          breeding_method?: string
          created_at?: string
          created_by?: string | null
          evidence?: string | null
          expected_due?: string | null
          female_born?: number | null
          homestead_id?: string
          id?: string
          male_born?: number | null
          notes?: string | null
          offspring_count?: number | null
          sire_id?: string | null
          status?: Database["public"]["Enums"]["pregnancy_status"]
          stillborn_count?: number | null
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
            foreignKeyName: "pregnancies_homestead_id_fkey"
            columns: ["homestead_id"]
            isOneToOne: false
            referencedRelation: "homesteads"
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
          homestead_id: string
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
          homestead_id?: string
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
          homestead_id?: string
          id?: string
          notes?: string | null
          produced_on?: string
          product_type?: string
          quantity?: number
          unit?: string
          value_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "production_logs_homestead_id_fkey"
            columns: ["homestead_id"]
            isOneToOne: false
            referencedRelation: "homesteads"
            referencedColumns: ["id"]
          },
        ]
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
          homestead_id: string
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
          homestead_id?: string
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
          homestead_id?: string
          id?: string
          link_id?: string | null
          link_type?: string | null
          notes?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_homestead_id_fkey"
            columns: ["homestead_id"]
            isOneToOne: false
            referencedRelation: "homesteads"
            referencedColumns: ["id"]
          },
        ]
      }
      user_current_homestead: {
        Row: {
          homestead_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          homestead_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          homestead_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_current_homestead_homestead_id_fkey"
            columns: ["homestead_id"]
            isOneToOne: false
            referencedRelation: "homesteads"
            referencedColumns: ["id"]
          },
        ]
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
          homestead_id: string
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
          homestead_id?: string
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
          homestead_id?: string
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
          {
            foreignKeyName: "weight_logs_homestead_id_fkey"
            columns: ["homestead_id"]
            isOneToOne: false
            referencedRelation: "homesteads"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_homestead_invitation: { Args: { _token: string }; Returns: string }
      can_admin_homestead: {
        Args: { _hid: string; _uid: string }
        Returns: boolean
      }
      can_write_data: { Args: { _uid: string }; Returns: boolean }
      can_write_homestead: {
        Args: { _hid: string; _uid: string }
        Returns: boolean
      }
      current_homestead_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      homestead_role: {
        Args: { _hid: string; _uid: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      is_approved_user: { Args: { _uid: string }; Returns: boolean }
      is_homestead_member: {
        Args: { _hid: string; _uid: string }
        Returns: boolean
      }
      is_homestead_owner: {
        Args: { _hid: string; _uid: string }
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
        | "nursing"
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
        "nursing",
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
