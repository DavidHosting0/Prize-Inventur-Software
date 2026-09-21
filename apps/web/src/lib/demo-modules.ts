export type DemoModuleId =
  | "lots"
  | "reorder"
  | "outlets"
  | "banquet"
  | "haccp"
  | "food-cost"
  | "variances"
  | "valuation"
  | "group-revenue"
  | "group-top-products"
  | "group-savings"
  | "group-insights";

export type DemoBadgeTone = "default" | "success" | "warning" | "danger" | "primary";
export type DemoKpiTone = "default" | "success" | "warning" | "danger";

export type DemoCell =
  | { t: "text"; v: string }
  | { t: "num"; v: number }
  | { t: "money"; v: number }
  | { t: "pct"; v: number }
  | { t: "badge"; v: string; tone: DemoBadgeTone }
  | { t: "label"; v: string };

export type DemoKpiDef = {
  key: string;
  value: DemoCell;
  hintKey?: string;
  tone?: DemoKpiTone;
};

export type DemoTableDef = {
  titleKey: string;
  columns: string[];
  rows: DemoCell[][];
};

export type DemoModuleDef = {
  id: DemoModuleId;
  navItemKey: string;
  actionKey: string;
  shell?: "app" | "group";
  kpis: DemoKpiDef[];
  tables: DemoTableDef[];
};

const txt = (v: string): DemoCell => ({ t: "text", v });
const num = (v: number): DemoCell => ({ t: "num", v });
const chf = (v: number): DemoCell => ({ t: "money", v });
const pct = (v: number): DemoCell => ({ t: "pct", v });
const badge = (v: string, tone: DemoBadgeTone): DemoCell => ({
  t: "badge",
  v,
  tone,
});
const label = (v: string): DemoCell => ({ t: "label", v });

export const DEMO_MODULES: Record<DemoModuleId, DemoModuleDef> = {
  lots: {
    id: "lots",
    navItemKey: "lots",
    actionKey: "export",
    kpis: [
      { key: "openLots", value: num(24) },
      {
        key: "expiringSoon",
        value: num(5),
        hintKey: "lots.hintExpiring",
        tone: "warning",
      },
      {
        key: "expired",
        value: num(1),
        hintKey: "lots.hintExpired",
        tone: "danger",
      },
      { key: "valueAtRisk", value: chf(1240), tone: "warning" },
    ],
    tables: [
      {
        titleKey: "openLots",
        columns: ["product", "lot", "expiry", "qty", "status"],
        rows: [
          [
            txt("Lachsfilet"),
            txt("CH-24091"),
            txt("23.09.2026"),
            txt("8 kg"),
            badge("critical", "danger"),
          ],
          [
            txt("Milch"),
            txt("CH-24088"),
            txt("25.09.2026"),
            txt("36 l"),
            badge("soon", "warning"),
          ],
          [
            txt("Joghurt Nature"),
            txt("CH-24086"),
            txt("26.09.2026"),
            txt("48 Becher"),
            badge("soon", "warning"),
          ],
          [
            txt("Butter"),
            txt("CH-24072"),
            txt("28.09.2026"),
            txt("12 kg"),
            badge("soon", "warning"),
          ],
          [
            txt("Eier"),
            txt("CH-24070"),
            txt("30.09.2026"),
            txt("180 Stk"),
            badge("soon", "warning"),
          ],
          [
            txt("Limette"),
            txt("CH-24064"),
            txt("04.10.2026"),
            txt("6 kg"),
            badge("ok", "success"),
          ],
          [
            txt("Croissant"),
            txt("CH-24102"),
            txt("22.09.2026"),
            txt("24 Stk"),
            badge("expired", "danger"),
          ],
          [
            txt("Orangensaft"),
            txt("CH-24055"),
            txt("12.10.2026"),
            txt("18 l"),
            badge("ok", "success"),
          ],
        ],
      },
    ],
  },

  reorder: {
    id: "reorder",
    navItemKey: "reorder",
    actionKey: "createOrder",
    kpis: [
      { key: "belowMin", value: num(8), tone: "warning" },
      { key: "orderValue", value: chf(2180) },
      { key: "urgent", value: num(3), hintKey: "reorder.hintUrgent", tone: "danger" },
      { key: "coverageDays", value: txt("4.2 d") },
    ],
    tables: [
      {
        titleKey: "suggestions",
        columns: [
          "product",
          "stock",
          "min",
          "suggested",
          "supplier",
          "status",
        ],
        rows: [
          [
            txt("Coca-Cola 0.33"),
            txt("18 Fl."),
            txt("24 Fl."),
            txt("12 Gebinde"),
            txt("Getränke AG Bern"),
            badge("urgent", "danger"),
          ],
          [
            txt("Tonic Water 0.2l"),
            txt("8 Fl."),
            txt("24 Fl."),
            txt("6 Gebinde"),
            txt("Getränke AG Bern"),
            badge("urgent", "danger"),
          ],
          [
            txt("Milch"),
            txt("12 l"),
            txt("24 l"),
            txt("36 l"),
            txt("Molkerei Emmental"),
            badge("urgent", "danger"),
          ],
          [
            txt("Croissant"),
            txt("16 Stk"),
            txt("40 Stk"),
            txt("80 Stk"),
            txt("Bäckerei Nyffeler"),
            badge("due", "warning"),
          ],
          [
            txt("Gin 0.7l"),
            txt("4 Fl."),
            txt("6 Fl."),
            txt("6 Fl."),
            txt("Getränke AG Bern"),
            badge("due", "warning"),
          ],
          [
            txt("Minibar Schokolade"),
            txt("22 Stk"),
            txt("40 Stk"),
            txt("48 Stk"),
            txt("Confiserie Bern"),
            badge("planned", "default"),
          ],
          [
            txt("Eier"),
            txt("60 Stk"),
            txt("120 Stk"),
            txt("180 Stk"),
            txt("Molkerei Emmental"),
            badge("due", "warning"),
          ],
          [
            txt("Wasser 0.5"),
            txt("40 Fl."),
            txt("48 Fl."),
            txt("8 Gebinde"),
            txt("Getränke AG Bern"),
            badge("planned", "default"),
          ],
        ],
      },
    ],
  },

  outlets: {
    id: "outlets",
    navItemKey: "outlets",
    actionKey: "newOutlet",
    kpis: [
      { key: "count", value: num(5) },
      { key: "stockValue", value: chf(18420) },
      { key: "belowPar", value: num(2), tone: "warning" },
      { key: "openRequisitions", value: num(4) },
    ],
    tables: [
      {
        titleKey: "overview",
        columns: [
          "outlet",
          "manager",
          "stockValue",
          "parFill",
          "status",
        ],
        rows: [
          [
            label("bar"),
            txt("Bar Staff"),
            chf(6240),
            pct(94),
            badge("okStock", "success"),
          ],
          [
            label("kitchen"),
            txt("F&B Manager"),
            chf(5180),
            pct(71),
            badge("belowPar", "warning"),
          ],
          [
            label("restaurant"),
            txt("F&B Manager"),
            chf(3920),
            pct(88),
            badge("okStock", "success"),
          ],
          [
            label("banquet"),
            txt("F&B Manager"),
            chf(2140),
            pct(62),
            badge("belowPar", "warning"),
          ],
          [
            label("housekeeping"),
            txt("Demo Admin"),
            chf(940),
            pct(96),
            badge("okStock", "success"),
          ],
        ],
      },
    ],
  },

  banquet: {
    id: "banquet",
    navItemKey: "banquet",
    actionKey: "newEvent",
    kpis: [
      { key: "eventsWeek", value: num(3) },
      { key: "covers", value: num(186) },
      { key: "reservedValue", value: chf(4820) },
      { key: "nextEvent", value: txt("22.09") },
    ],
    tables: [
      {
        titleKey: "events",
        columns: ["event", "date", "covers", "foodValue", "status"],
        rows: [
          [
            label("eventBoard"),
            txt("22.09.2026"),
            num(28),
            chf(840),
            badge("confirmed", "primary"),
          ],
          [
            label("eventWedding"),
            txt("26.09.2026"),
            num(110),
            chf(5280),
            badge("confirmed", "primary"),
          ],
          [
            label("eventApéro"),
            txt("24.09.2026"),
            num(48),
            chf(960),
            badge("inProgress", "warning"),
          ],
          [
            label("eventSeminar"),
            txt("29.09.2026"),
            num(35),
            chf(700),
            badge("planned", "default"),
          ],
          [
            label("eventWine"),
            txt("03.10.2026"),
            num(22),
            chf(1320),
            badge("planned", "default"),
          ],
          [
            label("eventStaff"),
            txt("18.09.2026"),
            num(16),
            chf(240),
            badge("done", "success"),
          ],
        ],
      },
    ],
  },

  haccp: {
    id: "haccp",
    navItemKey: "haccp",
    actionKey: "recordCheck",
    kpis: [
      { key: "fridges", value: num(6) },
      { key: "lastCheck", value: txt("06:15") },
      { key: "deviations", value: num(1), tone: "danger" },
      { key: "allergenItems", value: num(42) },
    ],
    tables: [
      {
        titleKey: "temps",
        columns: ["location", "target", "actual", "checkedAt", "status"],
        rows: [
          [
            label("coldRoom1"),
            txt("2–4 °C"),
            txt("3.1 °C"),
            txt("06:12"),
            badge("pass", "success"),
          ],
          [
            label("coldRoom2"),
            txt("2–4 °C"),
            txt("6.8 °C"),
            txt("06:14"),
            badge("fail", "danger"),
          ],
          [
            label("freezer"),
            txt("−18 °C"),
            txt("−19.2 °C"),
            txt("06:15"),
            badge("pass", "success"),
          ],
          [
            label("barFridge"),
            txt("4–8 °C"),
            txt("5.4 °C"),
            txt("07:02"),
            badge("pass", "success"),
          ],
          [
            label("minibarStore"),
            txt("8–12 °C"),
            txt("9.0 °C"),
            txt("07:40"),
            badge("pass", "success"),
          ],
          [
            label("breakfastFridge"),
            txt("2–5 °C"),
            txt("3.6 °C"),
            txt("05:50"),
            badge("pass", "success"),
          ],
        ],
      },
      {
        titleKey: "allergens",
        columns: [
          "product",
          "gluten",
          "lactose",
          "eggs",
          "nuts",
        ],
        rows: [
          [
            txt("Croissant"),
            badge("contains", "warning"),
            badge("contains", "warning"),
            badge("contains", "warning"),
            badge("free", "success"),
          ],
          [
            txt("Brötchen"),
            badge("contains", "warning"),
            badge("free", "success"),
            badge("free", "success"),
            badge("free", "success"),
          ],
          [
            txt("Lachsfilet"),
            badge("free", "success"),
            badge("free", "success"),
            badge("free", "success"),
            badge("free", "success"),
          ],
          [
            txt("Milch"),
            badge("free", "success"),
            badge("contains", "warning"),
            badge("free", "success"),
            badge("free", "success"),
          ],
          [
            txt("Minibar Schokolade"),
            badge("traces", "default"),
            badge("contains", "warning"),
            badge("traces", "default"),
            badge("contains", "warning"),
          ],
          [
            txt("Eier"),
            badge("free", "success"),
            badge("free", "success"),
            badge("contains", "warning"),
            badge("free", "success"),
          ],
        ],
      },
    ],
  },

  "food-cost": {
    id: "food-cost",
    navItemKey: "foodCost",
    actionKey: "export",
    kpis: [
      { key: "overall", value: pct(28.4), hintKey: "food-cost.hintTarget" },
      { key: "theoretical", value: pct(26.1), tone: "success" },
      {
        key: "variance",
        value: txt("+2.3 pp"),
        hintKey: "food-cost.hintVariance",
        tone: "warning",
      },
      { key: "revenue7d", value: chf(48320) },
    ],
    tables: [
      {
        titleKey: "byOutlet",
        columns: [
          "outlet",
          "revenue",
          "actual",
          "foodCost",
          "status",
        ],
        rows: [
          [
            label("restaurant"),
            chf(21480),
            pct(31.4),
            chf(6745),
            badge("watch", "warning"),
          ],
          [
            label("bar"),
            chf(16240),
            pct(18.2),
            chf(2956),
            badge("ok", "success"),
          ],
          [
            label("breakfast"),
            chf(6860),
            pct(34.8),
            chf(2387),
            badge("watch", "warning"),
          ],
          [
            label("banquet"),
            chf(2840),
            pct(27.1),
            chf(770),
            badge("ok", "success"),
          ],
          [
            label("minibar"),
            chf(900),
            pct(22.4),
            chf(202),
            badge("ok", "success"),
          ],
        ],
      },
    ],
  },

  variances: {
    id: "variances",
    navItemKey: "variances",
    actionKey: "export",
    kpis: [
      { key: "lastCount", value: txt("15.09") },
      { key: "shortage", value: chf(312), tone: "danger" },
      { key: "overage", value: chf(48), tone: "success" },
      { key: "net", value: chf(-264), tone: "warning" },
    ],
    tables: [
      {
        titleKey: "lines",
        columns: [
          "product",
          "book",
          "counted",
          "diff",
          "value",
          "reason",
        ],
        rows: [
          [
            txt("Gin 0.7l"),
            txt("6.0 l"),
            txt("5.4 l"),
            txt("−0.6 l"),
            chf(48),
            label("reasonPour"),
          ],
          [
            txt("Coca-Cola 0.33"),
            txt("84 Fl."),
            txt("79 Fl."),
            txt("−5 Fl."),
            chf(4.1),
            label("reasonComp"),
          ],
          [
            txt("Lachsfilet"),
            txt("12.0 kg"),
            txt("10.4 kg"),
            txt("−1.6 kg"),
            chf(76.8),
            label("reasonPrep"),
          ],
          [
            txt("Minibar Schokolade"),
            txt("40 Stk"),
            txt("36 Stk"),
            txt("−4 Stk"),
            chf(14.4),
            label("reasonMinibar"),
          ],
          [
            txt("Bier 0.33"),
            txt("48 Fl."),
            txt("52 Fl."),
            txt("+4 Fl."),
            chf(-8.8),
            label("reasonCount"),
          ],
          [
            txt("Croissant"),
            txt("24 Stk"),
            txt("18 Stk"),
            txt("−6 Stk"),
            chf(12.6),
            label("reasonWaste"),
          ],
          [
            txt("Vodka 0.7l"),
            txt("4.2 l"),
            txt("3.9 l"),
            txt("−0.3 l"),
            chf(18),
            label("reasonPour"),
          ],
          [
            txt("Butter"),
            txt("8.0 kg"),
            txt("8.5 kg"),
            txt("+0.5 kg"),
            chf(-4.2),
            label("reasonCount"),
          ],
        ],
      },
    ],
  },

  valuation: {
    id: "valuation",
    navItemKey: "valuation",
    actionKey: "export",
    kpis: [
      { key: "stockValue", value: chf(18420) },
      {
        key: "fifoDelta",
        value: chf(210),
        hintKey: "valuation.hintFifo",
        tone: "success",
      },
      { key: "categories", value: num(7) },
      { key: "slowMovers", value: chf(1080), tone: "warning" },
    ],
    tables: [
      {
        titleKey: "byCategory",
        columns: [
          "category",
          "avgValue",
          "fifoValue",
          "abc",
        ],
        rows: [
          [
            label("drinks"),
            chf(4120),
            chf(4188),
            badge("classA", "primary"),
          ],
          [
            label("bar"),
            chf(6240),
            chf(6310),
            badge("classA", "primary"),
          ],
          [
            label("breakfast"),
            chf(2860),
            chf(2894),
            badge("classB", "warning"),
          ],
          [
            label("restaurant"),
            chf(3180),
            chf(3210),
            badge("classB", "warning"),
          ],
          [
            label("snacks"),
            chf(740),
            chf(748),
            badge("classC", "default"),
          ],
          [
            label("minibar"),
            chf(940),
            chf(952),
            badge("classC", "default"),
          ],
          [
            label("other"),
            chf(340),
            chf(328),
            badge("classC", "default"),
          ],
        ],
      },
    ],
  },

  "group-revenue": {
    id: "group-revenue",
    navItemKey: "groupRevenue",
    actionKey: "export",
    shell: "group",
    kpis: [
      { key: "group30d", value: chf(142800) },
      { key: "bernShare", value: pct(61.9), hintKey: "group-revenue.hintBern" },
      {
        key: "bestDelta",
        value: txt("+8.4 %"),
        hintKey: "group-revenue.hintZurich",
        tone: "success",
      },
      { key: "vsLastMonth", value: txt("+6.2 %"), tone: "success" },
    ],
    tables: [
      {
        titleKey: "byHotel",
        columns: ["hotel", "thisMonth", "delta", "status"],
        rows: [
          [
            txt("Prize Bern"),
            chf(88420),
            txt("+5.1 %"),
            badge("lead", "primary"),
          ],
          [
            txt("Prize Zurich"),
            chf(54380),
            txt("+8.4 %"),
            badge("rising", "success"),
          ],
        ],
      },
    ],
  },

  "group-top-products": {
    id: "group-top-products",
    navItemKey: "groupTopProducts",
    actionKey: "export",
    shell: "group",
    kpis: [
      { key: "topSku", value: txt("Gin Tonic") },
      { key: "topRevenue", value: chf(18420) },
      { key: "share", value: pct(12.9) },
      { key: "classA", value: num(8) },
    ],
    tables: [
      {
        titleKey: "ranking",
        columns: ["product", "hotel", "revenue", "margin", "rank"],
        rows: [
          [
            txt("Gin Tonic"),
            txt("Prize Bern"),
            chf(12480),
            pct(71.2),
            badge("classA", "primary"),
          ],
          [
            txt("Coca-Cola 0.33"),
            txt("Gruppe"),
            chf(9620),
            pct(78.4),
            badge("classA", "primary"),
          ],
          [
            txt("Gin Tonic"),
            txt("Prize Zurich"),
            chf(5940),
            pct(69.8),
            badge("classA", "primary"),
          ],
          [
            txt("Croissant"),
            txt("Prize Bern"),
            chf(4280),
            pct(54.1),
            badge("classB", "warning"),
          ],
          [
            txt("Minibar Wasser 0.5"),
            txt("Gruppe"),
            chf(3120),
            pct(82.0),
            badge("classA", "primary"),
          ],
          [
            txt("Whisky Cola"),
            txt("Prize Zurich"),
            chf(2860),
            pct(64.5),
            badge("classB", "warning"),
          ],
        ],
      },
    ],
  },

  "group-savings": {
    id: "group-savings",
    navItemKey: "groupSavings",
    actionKey: "export",
    shell: "group",
    kpis: [
      { key: "identified", value: chf(4180), tone: "success" },
      { key: "waste", value: chf(860), tone: "warning" },
      { key: "overstock", value: chf(2140) },
      { key: "priceGap", value: chf(1180) },
    ],
    tables: [
      {
        titleKey: "opportunities",
        columns: ["topic", "hotel", "amount", "action", "status"],
        rows: [
          [
            label("saveContract"),
            txt("Gruppe"),
            chf(1180),
            label("actAlign"),
            badge("highImpact", "danger"),
          ],
          [
            label("saveOverstock"),
            txt("Prize Zurich"),
            chf(1240),
            label("actPar"),
            badge("highImpact", "danger"),
          ],
          [
            label("saveWaste"),
            txt("Prize Bern"),
            chf(420),
            label("actPar"),
            badge("watch", "warning"),
          ],
          [
            label("saveSlow"),
            txt("Prize Zurich"),
            chf(740),
            label("actPromo"),
            badge("watch", "warning"),
          ],
          [
            label("savePour"),
            txt("Prize Bern"),
            chf(600),
            label("actTrain"),
            badge("mediumImpact", "default"),
          ],
        ],
      },
    ],
  },

  "group-insights": {
    id: "group-insights",
    navItemKey: "groupInsights",
    actionKey: "export",
    shell: "group",
    kpis: [
      { key: "open", value: num(6) },
      { key: "priority", value: num(2), tone: "danger" },
      { key: "impact", value: chf(3920), tone: "success" },
      { key: "accepted", value: pct(64) },
    ],
    tables: [
      {
        titleKey: "recs",
        columns: ["insight", "hotel", "impact", "priority", "status"],
        rows: [
          [
            label("insContract"),
            txt("Gruppe"),
            chf(1180),
            badge("highImpact", "danger"),
            badge("newRec", "primary"),
          ],
          [
            label("insPar"),
            txt("Prize Zurich"),
            chf(1240),
            badge("highImpact", "danger"),
            badge("inReview", "warning"),
          ],
          [
            label("insCroissant"),
            txt("Prize Bern"),
            chf(420),
            badge("mediumImpact", "default"),
            badge("newRec", "primary"),
          ],
          [
            label("insGin"),
            txt("Gruppe"),
            chf(680),
            badge("mediumImpact", "default"),
            badge("planned", "default"),
          ],
          [
            label("insFoodCost"),
            txt("Prize Bern"),
            chf(400),
            badge("watch", "warning"),
            badge("inReview", "warning"),
          ],
        ],
      },
    ],
  },
};
