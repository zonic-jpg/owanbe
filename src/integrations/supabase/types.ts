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
      aso_ebi_campaigns: {
        Row: { id: string; event_id: string; owner_id: string; title: string; fabric_type: string | null; colors: string | null; qty_estimate: number | null; budget_per_unit: number | null; requirements: string | null; deadline: string | null; status: string; created_at: string }
        Insert: { id?: string; event_id: string; owner_id: string; title?: string; fabric_type?: string | null; colors?: string | null; qty_estimate?: number | null; budget_per_unit?: number | null; requirements?: string | null; deadline?: string | null; status?: string; created_at?: string }
        Update: { id?: string; event_id?: string; owner_id?: string; title?: string; fabric_type?: string | null; colors?: string | null; qty_estimate?: number | null; budget_per_unit?: number | null; requirements?: string | null; deadline?: string | null; status?: string; created_at?: string }
        Relationships: []
      }
      aso_ebi_guest_orders: {
        Row: { id: string; campaign_id: string; guest_id: string; qty: number; amount: number; paid: boolean; measurements: string | null; collected: boolean; created_at: string }
        Insert: { id?: string; campaign_id: string; guest_id: string; qty?: number; amount?: number; paid?: boolean; measurements?: string | null; collected?: boolean; created_at?: string }
        Update: { id?: string; campaign_id?: string; guest_id?: string; qty?: number; amount?: number; paid?: boolean; measurements?: string | null; collected?: boolean; created_at?: string }
        Relationships: []
      }
      aso_ebi_orders: {
        Row: { id: string; campaign_id: string; quote_id: string; provider_name: string; fabric: string | null; qty: number; unit_price: number; total: number; payment_status: string; payment_provider: string | null; payment_reference: string | null; ai_summary: string | null; created_at: string }
        Insert: { id?: string; campaign_id: string; quote_id: string; provider_name: string; fabric?: string | null; qty: number; unit_price: number; total: number; payment_status?: string; payment_provider?: string | null; payment_reference?: string | null; ai_summary?: string | null; created_at?: string }
        Update: { id?: string; campaign_id?: string; quote_id?: string; provider_name?: string; fabric?: string | null; qty?: number; unit_price?: number; total?: number; payment_status?: string; payment_provider?: string | null; payment_reference?: string | null; ai_summary?: string | null; created_at?: string }
        Relationships: []
      }
      aso_ebi_providers: {
        Row: { id: string; name: string; phone: string | null; whatsapp: string | null; city: string | null; specialties: string | null; vetted: boolean; rating: number | null; notes: string | null; created_at: string }
        Insert: { id?: string; name: string; phone?: string | null; whatsapp?: string | null; city?: string | null; specialties?: string | null; vetted?: boolean; rating?: number | null; notes?: string | null; created_at?: string }
        Update: { id?: string; name?: string; phone?: string | null; whatsapp?: string | null; city?: string | null; specialties?: string | null; vetted?: boolean; rating?: number | null; notes?: string | null; created_at?: string }
        Relationships: []
      }
      aso_ebi_quotes: {
        Row: { id: string; campaign_id: string; provider_id: string; fabric: string | null; price_per_unit: number; min_order: number; delivery_days: number | null; notes: string | null; status: string; created_at: string }
        Insert: { id?: string; campaign_id: string; provider_id: string; fabric?: string | null; price_per_unit: number; min_order?: number; delivery_days?: number | null; notes?: string | null; status?: string; created_at?: string }
        Update: { id?: string; campaign_id?: string; provider_id?: string; fabric?: string | null; price_per_unit?: number; min_order?: number; delivery_days?: number | null; notes?: string | null; status?: string; created_at?: string }
        Relationships: []
      }

      admin_permissions: {
        Row: {
          created_at: string
          granted_by: string
          id: string
          perm: Database["public"]["Enums"]["admin_perm"]
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by: string
          id?: string
          perm: Database["public"]["Enums"]["admin_perm"]
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string
          id?: string
          perm?: Database["public"]["Enums"]["admin_perm"]
          user_id?: string
        }
        Relationships: []
      }
      ai_summaries: {
        Row: {
          generated_at: string
          id: string
          ref_id: string
          scope: string
          suggestions: Json | null
          summary: string
        }
        Insert: {
          generated_at?: string
          id?: string
          ref_id: string
          scope: string
          suggestions?: Json | null
          summary: string
        }
        Update: {
          generated_at?: string
          id?: string
          ref_id?: string
          scope?: string
          suggestions?: Json | null
          summary?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          demo_login_enabled: boolean
          id: boolean
          preview_mode: string
          published_mode: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          demo_login_enabled?: boolean
          id?: boolean
          preview_mode?: string
          published_mode?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          demo_login_enabled?: boolean
          id?: boolean
          preview_mode?: string
          published_mode?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      brand_payments: {
        Row: {
          amount: number
          brand_id: string
          created_at: string
          currency: string
          external_ref: string | null
          id: string
          method: string
          paid_at: string | null
          status: Database["public"]["Enums"]["payment_status"]
          subscription_id: string | null
        }
        Insert: {
          amount: number
          brand_id: string
          created_at?: string
          currency?: string
          external_ref?: string | null
          id?: string
          method?: string
          paid_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          subscription_id?: string | null
        }
        Update: {
          amount?: number
          brand_id?: string
          created_at?: string
          currency?: string
          external_ref?: string | null
          id?: string
          method?: string
          paid_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_payments_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "brand_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_subscriptions: {
        Row: {
          amount: number
          brand_id: string
          cancel_at: string | null
          created_at: string
          currency: string
          id: string
          is_waived: boolean
          period_end: string
          period_start: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
          waiver_id: string | null
        }
        Insert: {
          amount: number
          brand_id: string
          cancel_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          is_waived?: boolean
          period_end: string
          period_start?: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          waiver_id?: string | null
        }
        Update: {
          amount?: number
          brand_id?: string
          cancel_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          is_waived?: boolean
          period_end?: string
          period_start?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          waiver_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_subscriptions_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_subscriptions_waiver_id_fkey"
            columns: ["waiver_id"]
            isOneToOne: false
            referencedRelation: "brand_waivers"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_vendors: {
        Row: {
          brand_id: string
          created_at: string
          vendor_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          vendor_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_vendors_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_vendors_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_waivers: {
        Row: {
          code: string | null
          created_at: string
          expires_at: string | null
          granted_by: string
          id: string
          is_active: boolean
          match_type: Database["public"]["Enums"]["waiver_match_type"]
          match_value: string
          notes: string | null
          used_at: string | null
          used_by_brand: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          expires_at?: string | null
          granted_by: string
          id?: string
          is_active?: boolean
          match_type: Database["public"]["Enums"]["waiver_match_type"]
          match_value: string
          notes?: string | null
          used_at?: string | null
          used_by_brand?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          expires_at?: string | null
          granted_by?: string
          id?: string
          is_active?: boolean
          match_type?: Database["public"]["Enums"]["waiver_match_type"]
          match_value?: string
          notes?: string | null
          used_at?: string | null
          used_by_brand?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_waivers_used_by_brand_fkey"
            columns: ["used_by_brand"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          bio: string | null
          contact_email: string
          contact_phone: string | null
          created_at: string
          id: string
          logo_url: string | null
          name: string
          owner_id: string
          rejection_reason: string | null
          slug: string | null
          status: Database["public"]["Enums"]["brand_status"]
          submitted_at: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          bio?: string | null
          contact_email: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          owner_id: string
          rejection_reason?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["brand_status"]
          submitted_at?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          bio?: string | null
          contact_email?: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string
          rejection_reason?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["brand_status"]
          submitted_at?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      budget_items: {
        Row: {
          category: Database["public"]["Enums"]["vendor_category"]
          created_at: string
          description: string | null
          id: string
          name: string
          position: number
          qty: number
          tier_id: string
          unit_price: number
          vendor_id: string | null
        }
        Insert: {
          category: Database["public"]["Enums"]["vendor_category"]
          created_at?: string
          description?: string | null
          id?: string
          name: string
          position?: number
          qty?: number
          tier_id: string
          unit_price?: number
          vendor_id?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["vendor_category"]
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          position?: number
          qty?: number
          tier_id?: string
          unit_price?: number
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_items_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_items_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_products: {
        Row: {
          attributes: Json
          category: Database["public"]["Enums"]["vendor_category"]
          city: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_featured: boolean
          name: string
          origin: string
          rating: number
          retain: boolean
          unit_label: string
          unit_price: number
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          attributes?: Json
          category: Database["public"]["Enums"]["vendor_category"]
          city?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          name: string
          origin?: string
          rating?: number
          retain?: boolean
          unit_label?: string
          unit_price?: number
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          attributes?: Json
          category?: Database["public"]["Enums"]["vendor_category"]
          city?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          name?: string
          origin?: string
          rating?: number
          retain?: boolean
          unit_label?: string
          unit_price?: number
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalog_products_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          origin: string
          population: number
          rank: number | null
          retain: boolean
          social_tags: string[]
          state: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          origin?: string
          population?: number
          rank?: number | null
          retain?: boolean
          social_tags?: string[]
          state?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          origin?: string
          population?: number
          rank?: number | null
          retain?: boolean
          social_tags?: string[]
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      client_404_logs: {
        Row: {
          created_at: string
          id: string
          kind: string
          referrer: string | null
          url: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          referrer?: string | null
          url: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          referrer?: string | null
          url?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      collaborators: {
        Row: {
          access_level: Database["public"]["Enums"]["collab_access"]
          created_at: string
          event_id: string
          expires_at: string | null
          id: string
          share_token: string
        }
        Insert: {
          access_level?: Database["public"]["Enums"]["collab_access"]
          created_at?: string
          event_id: string
          expires_at?: string | null
          id?: string
          share_token: string
        }
        Update: {
          access_level?: Database["public"]["Enums"]["collab_access"]
          created_at?: string
          event_id?: string
          expires_at?: string | null
          id?: string
          share_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "collaborators_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_spend_summary"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "collaborators_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_name: string
          body: string
          created_at: string
          event_id: string
          id: string
          item_id: string | null
          vote: number | null
        }
        Insert: {
          author_name: string
          body: string
          created_at?: string
          event_id: string
          id?: string
          item_id?: string | null
          vote?: number | null
        }
        Update: {
          author_name?: string
          body?: string
          created_at?: string
          event_id?: string
          id?: string
          item_id?: string | null
          vote?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_spend_summary"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "comments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      cover_jobs: {
        Row: {
          batch_size: number
          error_message: string | null
          failed: number
          finished_at: string | null
          id: string
          processed: number
          started_at: string
          status: string
          succeeded: number
          triggered_by: string | null
        }
        Insert: {
          batch_size?: number
          error_message?: string | null
          failed?: number
          finished_at?: string | null
          id?: string
          processed?: number
          started_at?: string
          status?: string
          succeeded?: number
          triggered_by?: string | null
        }
        Update: {
          batch_size?: number
          error_message?: string | null
          failed?: number
          finished_at?: string | null
          id?: string
          processed?: number
          started_at?: string
          status?: string
          succeeded?: number
          triggered_by?: string | null
        }
        Relationships: []
      }
      event_selections: {
        Row: {
          category: Database["public"]["Enums"]["vendor_category"]
          created_at: string
          event_id: string
          id: string
          locked_unit_price: number
          position: number
          product_id: string
          qty: number
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["vendor_category"]
          created_at?: string
          event_id: string
          id?: string
          locked_unit_price?: number
          position?: number
          product_id: string
          qty?: number
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["vendor_category"]
          created_at?: string
          event_id?: string
          id?: string
          locked_unit_price?: number
          position?: number
          product_id?: string
          qty?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_selections_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_spend_summary"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_selections_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_selections_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          budget_max: number
          budget_min: number
          budget_mode: Database["public"]["Enums"]["budget_mode"] | null
          city: string
          colors: string[] | null
          created_at: string
          event_date: string | null
          guest_count: number
          id: string
          name: string
          notes: string | null
          owner_id: string
          selected_tier: Database["public"]["Enums"]["tier_level"] | null
          status: Database["public"]["Enums"]["event_status"]
          type: Database["public"]["Enums"]["event_type"]
          updated_at: string
          vibe: string | null
        }
        Insert: {
          budget_max?: number
          budget_min?: number
          budget_mode?: Database["public"]["Enums"]["budget_mode"] | null
          city?: string
          colors?: string[] | null
          created_at?: string
          event_date?: string | null
          guest_count?: number
          id?: string
          name?: string
          notes?: string | null
          owner_id: string
          selected_tier?: Database["public"]["Enums"]["tier_level"] | null
          status?: Database["public"]["Enums"]["event_status"]
          type?: Database["public"]["Enums"]["event_type"]
          updated_at?: string
          vibe?: string | null
        }
        Update: {
          budget_max?: number
          budget_min?: number
          budget_mode?: Database["public"]["Enums"]["budget_mode"] | null
          city?: string
          colors?: string[] | null
          created_at?: string
          event_date?: string | null
          guest_count?: number
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string
          selected_tier?: Database["public"]["Enums"]["tier_level"] | null
          status?: Database["public"]["Enums"]["event_status"]
          type?: Database["public"]["Enums"]["event_type"]
          updated_at?: string
          vibe?: string | null
        }
        Relationships: []
      }
      guest_lists: {
        Row: { id: string; event_id: string; owner_id: string; name: string; created_at: string }
        Insert: { id?: string; event_id: string; owner_id: string; name?: string; created_at?: string }
        Update: { id?: string; event_id?: string; owner_id?: string; name?: string; created_at?: string }
        Relationships: []
      }
      guests: {
        Row: { id: string; list_id: string; name: string; phone: string | null; email: string | null; category: string; plus_ones: number; table_no: number | null; rsvp_status: string; invite_status: string; sent_via: string | null; sent_at: string | null; send_error: string | null; notes: string | null; created_at: string }
        Insert: { id?: string; list_id: string; name: string; phone?: string | null; email?: string | null; category?: string; plus_ones?: number; table_no?: number | null; rsvp_status?: string; invite_status?: string; sent_via?: string | null; sent_at?: string | null; send_error?: string | null; notes?: string | null; created_at?: string }
        Update: { id?: string; list_id?: string; name?: string; phone?: string | null; email?: string | null; category?: string; plus_ones?: number; table_no?: number | null; rsvp_status?: string; invite_status?: string; sent_via?: string | null; sent_at?: string | null; send_error?: string | null; notes?: string | null; created_at?: string }
        Relationships: []
      }
      admin_access_requests: {
        Row: { id: number; email: string; identity: string | null; app: string; status: string; requested_at: string; decided_at: string | null; decided_by: string | null; note: string | null }
        Insert: { id?: number; email: string; identity?: string | null; app?: string; status?: string; requested_at?: string; decided_at?: string | null; decided_by?: string | null; note?: string | null }
        Update: { id?: number; email?: string; identity?: string | null; app?: string; status?: string; requested_at?: string; decided_at?: string | null; decided_by?: string | null; note?: string | null }
        Relationships: []
      }
      landing_content: {
        Row: {
          id: string
          key: string
          kind: string
          notes: string | null
          origin: string
          position: number
          retain: boolean
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          id?: string
          key: string
          kind?: string
          notes?: string | null
          origin?: string
          position?: number
          retain?: boolean
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Update: {
          id?: string
          key?: string
          kind?: string
          notes?: string | null
          origin?: string
          position?: number
          retain?: boolean
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      product_analytics_events: {
        Row: {
          created_at: string
          event_id: string | null
          event_type: Database["public"]["Enums"]["product_event_type"]
          id: number
          product_id: string
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          event_type: Database["public"]["Enums"]["product_event_type"]
          id?: number
          product_id: string
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string | null
          event_type?: Database["public"]["Enums"]["product_event_type"]
          id?: number
          product_id?: string
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_analytics_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          city: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      role_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          target_user_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          target_user_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          target_user_id?: string
        }
        Relationships: []
      }
      service_price_config: {
        Row: {
          base_flat_price: number
          base_price_per_guest: number
          city: string
          id: string
          is_active: boolean
          notes: string | null
          origin: string
          retain: boolean
          service: Database["public"]["Enums"]["vendor_category"]
          tier_level: Database["public"]["Enums"]["tier_level"]
          updated_at: string
        }
        Insert: {
          base_flat_price?: number
          base_price_per_guest?: number
          city: string
          id?: string
          is_active?: boolean
          notes?: string | null
          origin?: string
          retain?: boolean
          service: Database["public"]["Enums"]["vendor_category"]
          tier_level: Database["public"]["Enums"]["tier_level"]
          updated_at?: string
        }
        Update: {
          base_flat_price?: number
          base_price_per_guest?: number
          city?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          origin?: string
          retain?: boolean
          service?: Database["public"]["Enums"]["vendor_category"]
          tier_level?: Database["public"]["Enums"]["tier_level"]
          updated_at?: string
        }
        Relationships: []
      }
      shortlists: {
        Row: {
          created_at: string
          event_id: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shortlists_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_spend_summary"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "shortlists_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shortlists_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      service_gate_audit: {
        Row: { id: string; service: string; action: string; old_value: Json | null; new_value: Json | null; actor: string | null; created_at: string }
        Insert: { id?: string; service: string; action: string; old_value?: Json | null; new_value?: Json | null; actor?: string | null; created_at?: string }
        Update: { id?: string; service?: string; action?: string; old_value?: Json | null; new_value?: Json | null; actor?: string | null; created_at?: string }
        Relationships: []
      }
      service_gates: {
        Row: { service: string; enabled: boolean; price: number; currency: string; model: string; label: string; updated_by: string | null; updated_at: string }
        Insert: { service: string; enabled?: boolean; price?: number; currency?: string; model?: string; label?: string; updated_by?: string | null; updated_at?: string }
        Update: { service?: string; enabled?: boolean; price?: number; currency?: string; model?: string; label?: string; updated_by?: string | null; updated_at?: string }
        Relationships: []
      }
      service_payments: {
        Row: { id: string; user_id: string; service: string; event_id: string | null; amount: number; currency: string; provider: string | null; reference: string | null; status: string; created_at: string }
        Insert: { id?: string; user_id: string; service: string; event_id?: string | null; amount?: number; currency?: string; provider?: string | null; reference?: string | null; status?: string; created_at?: string }
        Update: { id?: string; user_id?: string; service?: string; event_id?: string | null; amount?: number; currency?: string; provider?: string | null; reference?: string | null; status?: string; created_at?: string }
        Relationships: []
      }
      site_content: {
        Row: { id: number; data: Json; updated_at: string }
        Insert: { id?: number; data?: Json; updated_at?: string }
        Update: { id?: number; data?: Json; updated_at?: string }
        Relationships: []
      }
      sponsors: {
        Row: {
          brand_name: string
          category: Database["public"]["Enums"]["vendor_category"] | null
          copy: string | null
          created_at: string
          id: string
          is_active: boolean
          link: string | null
          logo_url: string | null
          origin: string
          retain: boolean
        }
        Insert: {
          brand_name: string
          category?: Database["public"]["Enums"]["vendor_category"] | null
          copy?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          link?: string | null
          logo_url?: string | null
          origin?: string
          retain?: boolean
        }
        Update: {
          brand_name?: string
          category?: Database["public"]["Enums"]["vendor_category"] | null
          copy?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          link?: string | null
          logo_url?: string | null
          origin?: string
          retain?: boolean
        }
        Relationships: []
      }
      tiers: {
        Row: {
          created_at: string
          event_id: string
          id: string
          level: Database["public"]["Enums"]["tier_level"]
          summary: string | null
          total_estimate: number
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          level: Database["public"]["Enums"]["tier_level"]
          summary?: string | null
          total_estimate?: number
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          level?: Database["public"]["Enums"]["tier_level"]
          summary?: string | null
          total_estimate?: number
        }
        Relationships: [
          {
            foreignKeyName: "tiers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_spend_summary"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "tiers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendor_analytics_events: {
        Row: {
          created_at: string
          event_type: Database["public"]["Enums"]["vendor_event_type"]
          id: number
          session_id: string | null
          user_id: string | null
          vendor_id: string
        }
        Insert: {
          created_at?: string
          event_type: Database["public"]["Enums"]["vendor_event_type"]
          id?: number
          session_id?: string | null
          user_id?: string | null
          vendor_id: string
        }
        Update: {
          created_at?: string
          event_type?: Database["public"]["Enums"]["vendor_event_type"]
          id?: number
          session_id?: string | null
          user_id?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_analytics_events_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_portfolio: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          image_url: string
          origin: string
          position: number
          retain: boolean
          vendor_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          image_url: string
          origin?: string
          position?: number
          retain?: boolean
          vendor_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          image_url?: string
          origin?: string
          position?: number
          retain?: boolean
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_portfolio_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_reviews: {
        Row: {
          author_id: string | null
          body: string | null
          created_at: string
          id: string
          rating: number
          vendor_id: string
        }
        Insert: {
          author_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          rating: number
          vendor_id: string
        }
        Update: {
          author_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          rating?: number
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_reviews_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          availability: Json
          bio: string | null
          category: Database["public"]["Enums"]["vendor_category"]
          city: string
          contact_email: string | null
          contact_phone: string | null
          cover_attempts: number
          cover_generated_at: string | null
          cover_last_error: string | null
          cover_phash: string | null
          cover_status: string
          cover_style_variant: number | null
          cover_subject_gender: string | null
          cover_subject_kind: string | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          id: string
          is_approved: boolean
          is_sponsored: boolean
          name: string
          origin: string
          price_band: Database["public"]["Enums"]["price_band"]
          rating: number
          retain: boolean
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          availability?: Json
          bio?: string | null
          category: Database["public"]["Enums"]["vendor_category"]
          city: string
          contact_email?: string | null
          contact_phone?: string | null
          cover_attempts?: number
          cover_generated_at?: string | null
          cover_last_error?: string | null
          cover_phash?: string | null
          cover_status?: string
          cover_style_variant?: number | null
          cover_subject_gender?: string | null
          cover_subject_kind?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_approved?: boolean
          is_sponsored?: boolean
          name: string
          origin?: string
          price_band?: Database["public"]["Enums"]["price_band"]
          rating?: number
          retain?: boolean
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          availability?: Json
          bio?: string | null
          category?: Database["public"]["Enums"]["vendor_category"]
          city?: string
          contact_email?: string | null
          contact_phone?: string | null
          cover_attempts?: number
          cover_generated_at?: string | null
          cover_last_error?: string | null
          cover_phash?: string | null
          cover_status?: string
          cover_style_variant?: number | null
          cover_subject_gender?: string | null
          cover_subject_kind?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_approved?: boolean
          is_sponsored?: boolean
          name?: string
          origin?: string
          price_band?: Database["public"]["Enums"]["price_band"]
          rating?: number
          retain?: boolean
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      venue_renderings: {
        Row: {
          created_at: string
          event_id: string
          id: string
          image_url: string
          kind: string
          prompt: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          image_url: string
          kind: string
          prompt?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          image_url?: string
          kind?: string
          prompt?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "venue_renderings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_spend_summary"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "venue_renderings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      event_spend_summary: {
        Row: {
          city: string | null
          event_id: string | null
          guest_band: string | null
          picks: number | null
          total_spend: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      apply_waiver_to_brand: {
        Args: { _brand: string; _code?: string }
        Returns: boolean
      }
      approve_brand: { Args: { _brand: string }; Returns: undefined }
      approve_preview: { Args: never; Returns: undefined }
      brand_financial_summary: {
        Args: never
        Returns: {
          active_subs: number
          month_start: string
          monthly_revenue: number
          payment_count: number
          waived_subs: number
        }[]
      }
      claim_super_admin: { Args: never; Returns: undefined }
      ensure_session_access: { Args: never; Returns: Json }
      founding_owner_email: { Args: never; Returns: string }
      request_admin_access: {
        Args: { _email: string; _identity?: string | null; _app?: string }
        Returns: Json
      }
      admin_access_status: {
        Args: { _email: string; _app?: string }
        Returns: Json
      }
      list_admin_access_requests: { Args: { _app?: string | null }; Returns: Json }
      decide_admin_access: {
        Args: { _email: string; _decision: string; _app?: string }
        Returns: Json
      }
      current_published_mode: { Args: never; Returns: string }
      ensure_demo_access: { Args: never; Returns: boolean }
      ensure_demo_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      grant_admin_permission: {
        Args: {
          _perm: Database["public"]["Enums"]["admin_perm"]
          _target: string
        }
        Returns: undefined
      }
      grant_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _target: string
        }
        Returns: undefined
      }
      has_admin_permission: {
        Args: {
          _perm: Database["public"]["Enums"]["admin_perm"]
          _user: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      promote_retained_to_live: { Args: never; Returns: number }
      purge_mock_data: { Args: never; Returns: number }
      record_product_event: {
        Args: {
          _event?: string
          _product: string
          _session?: string
          _type: Database["public"]["Enums"]["product_event_type"]
        }
        Returns: undefined
      }
      record_vendor_event: {
        Args: {
          _session?: string
          _type: Database["public"]["Enums"]["vendor_event_type"]
          _vendor: string
        }
        Returns: undefined
      }
      reject_brand: {
        Args: { _brand: string; _reason: string }
        Returns: undefined
      }
      request_brand_approval: { Args: { _brand: string }; Returns: undefined }
      revoke_admin_permission: {
        Args: {
          _perm: Database["public"]["Enums"]["admin_perm"]
          _target: string
        }
        Returns: undefined
      }
      revoke_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _target: string
        }
        Returns: undefined
      }
      row_visible: {
        Args: { _origin: string; _retain: boolean }
        Returns: boolean
      }
      set_demo_login_enabled: {
        Args: { _enabled: boolean }
        Returns: undefined
      }
      set_preview_mode: { Args: { _mode: string }; Returns: undefined }
    }
    Enums: {
      admin_perm: "view_financials" | "grant_waivers"
      app_role: "user" | "admin" | "super_admin" | "brand"
      brand_status:
        | "draft"
        | "awaiting_payment"
        | "awaiting_approval"
        | "approved"
        | "rejected"
        | "suspended"
      budget_mode: "fixed" | "open"
      collab_access: "view" | "comment"
      event_status: "draft" | "planning" | "confirmed" | "completed"
      event_type:
        | "wedding"
        | "birthday"
        | "burial"
        | "housewarming"
        | "chieftaincy"
        | "anniversary"
        | "naming"
        | "other"
      payment_status: "succeeded" | "pending" | "failed" | "waived" | "refunded"
      price_band: "affordable" | "mid" | "premium" | "luxury"
      product_event_type: "view" | "click" | "shortlist" | "select"
      subscription_plan: "monthly" | "annual"
      subscription_status:
        | "active"
        | "past_due"
        | "canceled"
        | "waived"
        | "pending"
      tier_level: "gold" | "platinum" | "diamond"
      vendor_category:
        | "decor"
        | "catering"
        | "photography"
        | "dj"
        | "mc"
        | "makeup"
        | "aso_ebi"
        | "cake"
        | "venue"
        | "drinks"
        | "security"
        | "logistics"
        | "souvenirs"
        | "planner"
        | "florist"
        | "videographer"
        | "hair_stylist"
        | "bridal_wear"
        | "gele"
        | "lighting_av"
        | "transport"
        | "stationery"
        | "rentals"
        | "bar_service"
        | "groom_attire"
        | "jewellery"
        | "small_chops"
        | "dessert_table"
        | "photo_booth"
        | "fireworks"
        | "kids_entertainment"
        | "alaga"
        | "proposal_planner"
      vendor_event_type:
        | "view"
        | "shortlist_add"
        | "contact_whatsapp"
        | "contact_email"
        | "contact_phone"
      waiver_match_type: "name" | "email" | "code"
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
      admin_perm: ["view_financials", "grant_waivers"],
      app_role: ["user", "admin", "super_admin", "brand"],
      brand_status: [
        "draft",
        "awaiting_payment",
        "awaiting_approval",
        "approved",
        "rejected",
        "suspended",
      ],
      budget_mode: ["fixed", "open"],
      collab_access: ["view", "comment"],
      event_status: ["draft", "planning", "confirmed", "completed"],
      event_type: [
        "wedding",
        "birthday",
        "burial",
        "housewarming",
        "chieftaincy",
        "anniversary",
        "naming",
        "other",
      ],
      payment_status: ["succeeded", "pending", "failed", "waived", "refunded"],
      price_band: ["affordable", "mid", "premium", "luxury"],
      product_event_type: ["view", "click", "shortlist", "select"],
      subscription_plan: ["monthly", "annual"],
      subscription_status: [
        "active",
        "past_due",
        "canceled",
        "waived",
        "pending",
      ],
      tier_level: ["gold", "platinum", "diamond"],
      vendor_category: [
        "decor",
        "catering",
        "photography",
        "dj",
        "mc",
        "makeup",
        "aso_ebi",
        "cake",
        "venue",
        "drinks",
        "security",
        "logistics",
        "souvenirs",
        "planner",
        "florist",
        "videographer",
        "hair_stylist",
        "bridal_wear",
        "gele",
        "lighting_av",
        "transport",
        "stationery",
        "rentals",
        "bar_service",
        "groom_attire",
        "jewellery",
        "small_chops",
        "dessert_table",
        "photo_booth",
        "fireworks",
        "kids_entertainment",
        "alaga",
        "proposal_planner",
      ],
      vendor_event_type: [
        "view",
        "shortlist_add",
        "contact_whatsapp",
        "contact_email",
        "contact_phone",
      ],
      waiver_match_type: ["name", "email", "code"],
    },
  },
} as const
