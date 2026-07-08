# Dashboard Design System

This document outlines the design specifications for the **Admin Dashboard** and **Resident Dashboard**.

## 1. Global Brand & Colors

### Core Palette
- **Primary Brand:** `#4F46E5` (Indigo) - Used for primary buttons, active states, and focus rings.
- **Secondary:** `#0EA5E9` (Sky Blue) - Used for secondary actions and highlights.

### Semantic Colors
- **Success:** `#10B981` (Emerald) - Approvals, completed tasks, successful payments.
- **Warning:** `#F59E0B` (Amber) - Pending items, warnings.
- **Danger:** `#EF4444` (Red) - Errors, deletions, overdue alerts.
- **Info:** `#3B82F6` (Blue) - Informational banners or neutral alerts.

### Neutrals (Light Mode)
- **Background:** `#F3F4F6` (Gray 100) - Main app background.
- **Surface:** `#FFFFFF` (White) - Card and modal backgrounds.
- **Text Primary:** `#111827` (Gray 900) - Headings and primary body text.
- **Text Secondary:** `#6B7280` (Gray 500) - Subtitles, helper text, and disabled states.
- **Borders:** `#E5E7EB` (Gray 200) - Dividers and card borders.

## 2. Typography

- **Font Family:** `Inter`, `Roboto`, or system sans-serif.
- **Weights:** Regular (400), Medium (500), SemiBold (600), Bold (700).

### Scale
- **H1 (Page Titles):** 24px (1.5rem), Bold
- **H2 (Section Titles):** 20px (1.25rem), SemiBold
- **H3 (Card Titles):** 16px (1rem), SemiBold
- **Body (Default):** 14px (0.875rem), Regular
- **Caption (Small):** 12px (0.75rem), Regular

## 3. UI Components

### Buttons
- **Primary:** Solid `#4F46E5` background, white text, 6px border radius. Hover: `#4338CA`.
- **Secondary:** White background, `#E5E7EB` border, `#374151` text. Hover: `#F9FAFB`.
- **Ghost/Tertiary:** Transparent background, `#4F46E5` text. Hover: Light indigo background.

### Cards & Surfaces
- **Style:** `#FFFFFF` background, 8px border radius (`rounded-lg`), subtle shadow (`box-shadow: 0 1px 3px rgba(0,0,0,0.1)`).
- **Padding:** 20px or 24px internal padding.

### Forms & Inputs
- **Inputs:** 6px border radius, `#E5E7EB` border, 14px text. Focus state has a 2px `#4F46E5` ring.
- **Labels:** 14px, Medium weight, `#374151` text.

---

## 4. Dashboard Specifics

### 4.1 Admin Dashboard
*Targeted at property managers, staff, and system administrators.*

- **Layout Structure:**
  - **Left Sidebar:** Fixed navigation, collapsible. Contains links to Dashboard, Residents, Maintenance, Billing, Settings.
  - **Top Bar:** Global search, notifications bell, admin profile dropdown.
  - **Main Content:** Wide area optimized for desktop data viewing.
- **Design Vibe:** Data-dense, functional, professional, and efficient.
- **Key UI Patterns:**
  - **Stat Cards (KPIs):** Top row showing Total Residents, Pending Requests, Monthly Revenue.
  - **Data Tables:** Extensive tables with sorting, filtering, bulk actions, and pagination.
  - **Charts:** Line charts for revenue trends, donut charts for request statuses.

### 4.2 Resident Dashboard
*Targeted at end-users living in the property.*

- **Layout Structure:**
  - **Mobile-First Approach:** Must look perfect on mobile screens.
  - **Bottom Navigation (Mobile):** Home, Payments, Requests, Profile.
  - **Top Navigation (Desktop):** Horizontal menu for simpler navigation.
- **Design Vibe:** Friendly, spacious, accessible, and action-oriented.
- **Key UI Patterns:**
  - **Quick Actions:** Prominent, large buttons for "Pay Rent" and "New Request".
  - **Feed/List Layout:** A vertical feed of recent announcements, upcoming events, and open maintenance tickets.
  - **Summary Cards:** Large, clear typography showing "Current Balance" and "Next Payment Date".
