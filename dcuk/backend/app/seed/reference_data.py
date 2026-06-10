"""Seed rate cards, APL, recipes, pricing guidelines, app settings. Idempotent."""
from datetime import date


def seed_reference_data(db):
    from app.models.reference import RateCard, APLItem, Recipe, PricingGuideline, AppSetting
    if db.query(RateCard).count() > 0:
        return

    effective_from = date(2026, 1, 1)

    # F&B Rate Cards (20 items)
    fb_rates = [
        ("Breakfast hot meal — economy", 4.85, "per_pax"),
        ("Breakfast cold option — economy", 3.20, "per_pax"),
        ("Premium cabin full hot meal — business", 18.50, "per_pax"),
        ("First class tasting menu", 42.00, "per_pax"),
        ("Economy snack pack (short haul)", 2.10, "per_pax"),
        ("Champagne service — business", 9.80, "per_pax"),
        ("Business class dessert course", 5.40, "per_pax"),
        ("Long-haul economy cold meal", 5.90, "per_pax"),
        ("Hot sandwich service", 3.75, "per_pax"),
        ("Afternoon tea service — business", 12.20, "per_pax"),
        ("Long-haul economy full dinner", 7.60, "per_pax"),
        ("Short-haul wrap — buy-on-board", 4.50, "per_item"),
        ("Vegetarian premium option", 5.20, "per_pax"),
        ("Special dietary — HNML", 6.80, "per_pax"),
        ("Beverage pack — economy (hot/cold)", 1.40, "per_pax"),
        ("Beverage pack — business (full bar)", 8.60, "per_pax"),
        ("Children's meal box", 4.10, "per_pax"),
        ("Buy-on-board premium pack A", 6.95, "per_item"),
        ("Crew meal (standard)", 5.50, "per_crew"),
        ("Transit snack — short connection", 1.80, "per_pax"),
    ]
    for name, cost, unit in fb_rates:
        db.add(RateCard(category="fb", line_item_name=name, cost_gbp=cost, unit=unit,
                        effective_from=effective_from, is_illustrative=True))

    # Non-F&B Rate Cards (15 items)
    non_fb_rates = [
        ("Galley equipment — standard fit", 120.00, "per_flight"),
        ("Standard tray set (economy)", 0.85, "per_pax"),
        ("Premium tray set (business/first)", 4.20, "per_pax"),
        ("Packaging — economy (primary)", 0.32, "per_pax"),
        ("Packaging — business (primary)", 1.10, "per_pax"),
        ("Service trolley — per unit per flight", 28.00, "per_flight"),
        ("Disposables pack — standard", 0.45, "per_pax"),
        ("Cleaning and waste management", 65.00, "per_flight"),
        ("Cold chain logistics — per flight", 95.00, "per_flight"),
        ("Loading crew — per turnaround", 210.00, "per_flight"),
        ("Ramp service charge", 85.00, "per_flight"),
        ("Security compliance surcharge", 35.00, "per_flight"),
        ("Customs documentation — bonded", 22.00, "per_flight"),
        ("Bonded store handling fee", 48.00, "per_flight"),
        ("Cold storage logistics surcharge", 30.00, "per_flight"),
    ]
    for name, cost, unit in non_fb_rates:
        db.add(RateCard(category="non_fb", line_item_name=name, cost_gbp=cost, unit=unit,
                        effective_from=effective_from, is_illustrative=True))

    db.flush()

    # APL Items (50 items)
    apl_items = [
        # Food — fresh
        ("Free-range British eggs (dozen)", "food", "fresh_produce", "Freshfields Farm", 2.40, "per_dozen"),
        ("Smoked Scottish salmon (200g portion)", "food", "fresh_produce", "Highland Catch Co.", 4.80, "per_portion"),
        ("British chicken breast (120g portion)", "food", "fresh_produce", "Meadow Grove Foods", 1.95, "per_portion"),
        ("Beef sirloin (150g)", "food", "fresh_produce", "Prime Select UK", 5.20, "per_portion"),
        ("Seasonal mixed salad leaves (100g)", "food", "fresh_produce", "GreenLeaf Produce", 0.85, "per_portion"),
        ("Cheddar cheese selection (80g)", "food", "fresh_produce", "Dairy Heritage", 1.60, "per_portion"),
        ("Vegetable medley (120g)", "food", "fresh_produce", "Sunrise Fresh", 0.70, "per_portion"),
        ("Fruit salad (120g pot)", "food", "fresh_produce", "Orchard Direct", 1.10, "per_pot"),
        # Food — ambient
        ("Chocolate brownie individual", "food", "ambient_bakery", "Sweet Origins", 0.95, "per_item"),
        ("Croissant — butter (individual)", "food", "ambient_bakery", "Artisan Bake Co.", 0.68, "per_item"),
        ("Digestive biscuits (2 pack)", "food", "ambient_snack", "Plantation Biscuits", 0.22, "per_pack"),
        ("Mixed nuts pack (30g)", "food", "ambient_snack", "Nature's Best", 0.85, "per_pack"),
        ("Porridge sachet (standard)", "food", "ambient_breakfast", "Harvest Oats", 0.55, "per_sachet"),
        ("Dark chocolate selection (3 pieces)", "food", "ambient_confectionery", "Cacao Luxe", 1.20, "per_pack"),
        ("Breadsticks — sesame (40g)", "food", "ambient_snack", "Rustico Bakery", 0.40, "per_pack"),
        ("Tomato soup carton (200ml)", "food", "ambient_hot", "Countryside Soups", 0.92, "per_carton"),
        # Beverages — non-alcoholic
        ("Mineral water 500ml still", "beverage", "soft_drink", "Springvale Waters", 0.48, "per_bottle"),
        ("Orange juice carton 200ml", "beverage", "soft_drink", "Grove Squeeze", 0.62, "per_carton"),
        ("Earl Grey tea — premium bag", "beverage", "hot_drink", "Regent Tea Co.", 0.18, "per_bag"),
        ("Arabica coffee sachet — premium", "beverage", "hot_drink", "Altitude Roasters", 0.42, "per_sachet"),
        ("Cola can 330ml", "beverage", "soft_drink", "Classic Beverages", 0.55, "per_can"),
        ("Sparkling water 250ml", "beverage", "soft_drink", "Springvale Waters", 0.52, "per_can"),
        # Beverages — alcoholic
        ("House white wine (187ml)", "beverage", "alcoholic", "Vineyard Select", 2.40, "per_bottle"),
        ("House red wine (187ml)", "beverage", "alcoholic", "Vineyard Select", 2.40, "per_bottle"),
        ("Premium champagne (187ml)", "beverage", "alcoholic", "Maison Prestige", 8.50, "per_bottle"),
        ("IPA craft beer (330ml)", "beverage", "alcoholic", "Craft & Cooper", 1.85, "per_can"),
        ("Spirits miniature — gin (50ml)", "beverage", "alcoholic", "Distillers Guild", 3.20, "per_miniature"),
        # Equipment
        ("Standard galley trolley — full", "equipment", "galley", "AeroCatering Systems", 285.00, "per_unit"),
        ("Hot beverage cart — standard", "equipment", "galley", "AeroCatering Systems", 195.00, "per_unit"),
        ("Serving tongs — stainless steel", "equipment", "service", "Aero Utensils Ltd", 8.50, "per_unit"),
        # Packaging — primary
        ("Economy meal tray with lid", "packaging", "primary", "PackRight Aviation", 0.28, "per_unit"),
        ("Business meal box — premium", "packaging", "primary", "LuxPack UK", 1.45, "per_unit"),
        ("Hot cup with lid 12oz", "packaging", "primary", "EcoServe Ltd", 0.14, "per_unit"),
        ("Cold cup 8oz clear", "packaging", "primary", "EcoServe Ltd", 0.08, "per_unit"),
        ("Napkin — economy cotton-feel", "packaging", "service", "ServiceWare UK", 0.06, "per_unit"),
        ("Napkin — premium linen", "packaging", "service", "ServiceWare UK", 0.45, "per_unit"),
        # Packaging — secondary
        ("Thermal meal bag — economy", "packaging", "secondary", "InsulPack Ltd", 0.65, "per_unit"),
        ("Cold chain ice block (standard)", "packaging", "secondary", "FrostKit Systems", 1.20, "per_unit"),
        # Consumables — cleaning
        ("Antibacterial wipe sachets (2pk)", "consumable", "cleaning", "HygieneFirst UK", 0.12, "per_pack"),
        ("Surface sanitiser spray 500ml", "consumable", "cleaning", "CleanPro Ltd", 3.80, "per_bottle"),
        # Consumables — service
        ("Cutlery set — economy (wrapped)", "consumable", "service", "AeroWare Ltd", 0.22, "per_set"),
        ("Cutlery set — business (metal)", "consumable", "service", "AeroWare Ltd", 4.80, "per_set"),
        ("Salt & pepper sachet pair", "consumable", "service", "Condiment Co.", 0.04, "per_pair"),
        ("Sugar sachet", "consumable", "service", "Condiment Co.", 0.03, "per_sachet"),
        ("Stirrer — wooden", "consumable", "service", "NaturalServe Ltd", 0.02, "per_unit"),
        ("Cream portion (10ml UHT)", "consumable", "service", "Dairy Heritage", 0.08, "per_portion"),
        ("Toothpick — wooden wrapped", "consumable", "service", "AeroWare Ltd", 0.01, "per_unit"),
        ("Wet wipe (individual sealed)", "consumable", "service", "HygieneFirst UK", 0.18, "per_unit"),
        ("Blanket — economy fleece", "consumable", "amenity", "SkyComfort Ltd", 3.50, "per_unit"),
        ("Amenity kit — economy compact", "consumable", "amenity", "SkyComfort Ltd", 4.20, "per_kit"),
    ]
    for name, cat, sub_cat, supplier, price, unit in apl_items:
        db.add(APLItem(product_name=name, category=cat, sub_category=sub_cat, supplier=supplier,
                       agreed_price_gbp=price, unit=unit, effective_from=effective_from,
                       status="active", is_illustrative=True))

    db.flush()

    # Recipes (30)
    recipes = [
        ("Classic English Breakfast Box", "economy_hot", "economy", 5.40),
        ("Smoked Salmon Starter", "business_starter", "business", 7.20),
        ("Chicken Tikka Masala — Long Haul", "economy_hot_long", "economy", 6.80),
        ("Cheese & Charcuterie Board", "business_cheese", "business", 9.50),
        ("Mezze Platter — Vegetarian", "business_starter", "business", 6.40),
        ("Vegetarian Pasta Primavera", "economy_hot", "economy", 5.10),
        ("Children's Lunchbox", "economy_cold", "economy", 4.20),
        ("Cream Tea Service", "business_snack", "business", 11.80),
        ("Premium Chocolate Dessert Plate", "first_dessert", "first", 14.20),
        ("Beef Sirloin — First Class Main", "first_main", "first", 28.50),
        ("Short Haul Snack Bag Economy", "economy_snack", "economy", 2.80),
        ("Buy-On-Board Club Sandwich", "bob_hot", "economy", 4.60),
        ("Crew Meal — Standard Rotation", "crew", "crew", 5.20),
        ("Healthy Option Salad Box", "economy_cold", "economy", 4.90),
        ("Full English Hot Breakfast (Business)", "business_breakfast", "business", 13.40),
        ("Continental Breakfast Cold (Economy)", "economy_cold", "economy", 3.80),
        ("HNML Grilled Chicken & Rice", "special_dietary", "economy", 6.50),
        ("VGML Lentil & Vegetable Curry", "special_dietary", "economy", 5.90),
        ("KSML Kosher Chicken Meal", "special_dietary", "economy", 8.20),
        ("MOML Hindu Meal", "special_dietary", "economy", 6.10),
        ("Fish & Chips (Long Haul Economy)", "economy_hot_long", "economy", 7.40),
        ("Lamb Tagine (Business Class)", "business_main", "business", 16.80),
        ("Pan-Seared Salmon (Business)", "business_main", "business", 15.60),
        ("Vegan Thai Green Curry (Economy)", "economy_hot", "economy", 5.60),
        ("Premium Cheese Selection (First)", "first_cheese", "first", 18.90),
        ("Buy-On-Board Hot Sausage Roll", "bob_hot", "economy", 3.40),
        ("Economy Afternoon Snack Box", "economy_snack", "economy", 3.10),
        ("Business Canapé Selection", "business_snack", "business", 8.80),
        ("Long Haul Economy Dessert Cup", "economy_cold", "economy", 2.40),
        ("Transit Refresh Pack", "economy_snack", "economy", 2.10),
    ]
    for name, cat, cabin, cost in recipes:
        db.add(Recipe(name=name, category=cat, cabin_class=cabin,
                      calculated_cost_gbp=cost, last_reviewed_date=effective_from,
                      is_illustrative=True, ingredients=[]))

    # Pricing guidelines
    db.add(PricingGuideline(
        effective_from=effective_from,
        min_margin_pct=8.0,
        target_margin_pct=14.0,
        floor_formula_description=(
            "Floor = Total annual cost / (1 - minimum margin %). "
            "Minimum margin 8% applied to all tenders unless exception approved by Finance Director. "
            "Target margin 14% applied as default pricing parameter."
        ),
        exception_threshold_gbp=500000,
        is_illustrative=True,
    ))

    # App settings (SLA, branch routing, etc.)
    settings_data = [
        ("sla_receive_tender_hours", 1, "SLA for logging tender after receipt (hours)", "sla"),
        ("sla_notify_inner_circle_hours", 24, "SLA for HL view + schedule after receipt (hours)", "sla"),
        ("sla_interpret_requirements_hours", 24, "SLA for requirements set finalisation (hours)", "sla"),
        ("sla_initial_financial_view_hours", 36, "SLA for initial financial view (hours)", "sla"),
        ("sla_et_go_nogo_hours", 24, "ET 24h SLA for Go/No-Go decision (hours)", "sla"),
        ("sla_element_loop_hours", 48, "SLA for element loop completion (hours)", "sla"),
        ("branch_max_contract_value_gbp", 500000, "Light path threshold: max contract value (£)", "branch_routing"),
        ("branch_is_renewal_required", True, "Light path: must be a renewal/re-tender", "branch_routing"),
        ("branch_max_working_days_deadline", 5, "Light path: max working days to submission deadline", "branch_routing"),
        ("et_delegation_threshold_gbp", 500000, "Below this value, ET may delegate Go/No-Go to Sales Director", "pricing"),
        ("target_margin_pct", 14.0, "Default target margin percentage", "pricing"),
        ("min_margin_pct", 8.0, "Minimum acceptable margin percentage", "pricing"),
    ]
    for key, value, desc, cat in settings_data:
        db.add(AppSetting(key=key, value=value, description=desc, category=cat))

    db.commit()
    print(f"  Seeded rate cards, APL, recipes, pricing guidelines and app settings")
