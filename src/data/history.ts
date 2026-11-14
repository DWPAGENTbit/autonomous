import type { ActivityEvent, Decision } from "@/types/domain";

const t = (h: number, m: number, s = 0) => h * 3600 + m * 60 + s;

/**
 * Decisions made earlier in the session — the agent's record of reasoning.
 * Factors are concise and inspectable; no hidden chain-of-thought.
 */
export const SEED_DECISIONS: readonly Decision[] = [
  {
    id: "dec-sol-reject",
    at: t(9, 4),
    domain: "MARKETS",
    subject: "SOL / USDT",
    outcome: "REJECT",
    headline: "Ditolak: nilai harapan di bawah minimum kebijakan.",
    chain: [
      {
        label: "Peluang",
        value: "SOL / USDT",
        status: "neutral",
        detail: "Breakout di atas rentang 20 hari dengan volume naik.",
        metrics: [{ label: "Batas atas rentang", value: "$148.20" }],
      },
      {
        label: "Rezim pasar",
        value: "Risk-on",
        status: "pass",
        detail: "Breadth kripto positif; 4 dari 5 koin utama di atas tren.",
      },
      {
        label: "Sinyal",
        value: "Breakout",
        status: "pass",
        detail: "Penutupan di atas batas atas rentang dengan volume 1,3× rata-rata 20 hari.",
        metrics: [{ label: "Rasio volume", value: "1,3×" }],
      },
      {
        label: "Nilai harapan",
        value: "+0.5R",
        status: "fail",
        detail:
          "Breakout dengan volume di bawah 1,5× hanya menghasilkan +0.5R dari 41 setup historis. Minimum kebijakan +0.8R.",
        metrics: [
          { label: "Sampel", value: "41 setup" },
          { label: "Minimum kebijakan", value: "+0.8R" },
        ],
      },
      {
        label: "Risiko portofolio",
        value: "Tidak dievaluasi",
        status: "neutral",
        detail: "Dilewati: setup sudah gagal di syarat sebelumnya.",
      },
      {
        label: "Keputusan",
        value: "Tolak",
        status: "fail",
        detail: "Konfirmasi volume yang lemah membuat keunggulannya terlalu tipis untuk ditransaksikan.",
      },
    ],
    factors: [
      "Rezim dan sinyal breakout sama-sama dapat diterima.",
      "Konfirmasi volume (1,3×) di bawah level 1,5× tempat sinyal ini biasanya berhasil.",
      "Nilai harapan +0.5R di bawah minimum kebijakan +0.8R.",
    ],
    confidence: 0.77,
    invalidation: "Evaluasi ulang jika volume melampaui 1,5× rata-rata 20 hari dengan penutupan di atas $148.20.",
    assumptions: ["Nilai harapan dari 41 breakout sebanding selama dua tahun."],
  },
  {
    id: "dec-doc-pursue",
    at: t(9, 18),
    domain: "BUSINESS",
    subject: "Otomasi dokumen AI",
    outcome: "PURSUE",
    headline: "Kejar: kemampuan sangat cocok, dengan pembeli langganan.",
    opportunityId: "opp-doc-automation",
    chain: [
      {
        label: "Peluang",
        value: "Otomasi dokumen",
        status: "neutral",
        detail: "Ekstraksi invoice dan bill of lading untuk broker kargo.",
      },
      {
        label: "Permintaan",
        value: "Terverifikasi",
        status: "pass",
        detail: "Klien sudah merekrut 31 kali; anggaran tercantum di listing.",
      },
      {
        label: "Kecocokan kemampuan",
        value: "4 dari 5",
        status: "pass",
        detail: "Pipeline yang ada mencakup ekstraksi, validasi, ekspor, dan antrean review.",
      },
      {
        label: "Nilai harapan",
        value: "$286",
        status: "pass",
        detail: "$420 × probabilitas menang 68%.",
        metrics: [
          { label: "Nilai", value: "$420" },
          { label: "Probabilitas", value: "68%" },
        ],
      },
      {
        label: "Usaha",
        value: "5,5 jam",
        status: "pass",
        detail: "Tarif efektif ~$52/jam dari nilai harapan.",
      },
      {
        label: "Keputusan",
        value: "Kejar",
        status: "pass",
        detail: "Susun proposal dengan demo memakai contoh dari klien.",
      },
    ],
    factors: [
      "Pembeli langganan dengan belanja terverifikasi $48 rb.",
      "Pipeline yang ada sudah mencakup 4 dari 5 kebutuhan.",
      "Nilai harapan $286 untuk 5,5 jam melampaui batas minimum $40/jam.",
    ],
    confidence: 0.68,
    invalidation: "Batalkan jika klien meminta integrasi API TMS langsung dalam harga tetap.",
    assumptions: ["Probabilitas menang berdasarkan 14 pekerjaan sebanding dalam 90 hari."],
  },
];

/** Proof of work: everything the agent did this morning, in order. */
export const SEED_ACTIVITY: readonly ActivityEvent[] = [
  { id: "a-01", at: t(8, 42, 4), kind: "SCANNING", message: "Pindaian pasar pagi dimulai pada 1.284 instrumen." },
  { id: "a-02", at: t(8, 44, 31), kind: "FILTERING", message: "38 instrumen lolos syarat likuiditas dan spread." },
  {
    id: "a-03",
    at: t(8, 47, 12),
    kind: "SEARCH",
    message: "Menemukan listing otomasi dokumen di Upwork.",
    opportunityId: "opp-doc-automation",
    evidence: [{ label: "Belanja klien", value: "$48 rb", source: "Upwork" }],
  },
  { id: "a-04", at: t(8, 51, 40), kind: "SIMULATION", message: "Backtest selesai: strategi breakout, 90 hari, 62 setup, rata-rata +1.4R." },
  {
    id: "a-05",
    at: t(8, 55, 2),
    kind: "SEARCH",
    message: "Minat pencarian template onboarding naik 34% dalam 90 hari.",
    opportunityId: "opp-notion-templates",
  },
  { id: "a-06", at: t(9, 1, 18), kind: "RISK", message: "Cek risiko: nilai harapan SOL / USDT +0.5R, di bawah minimum +0.8R.", decisionId: "dec-sol-reject" },
  {
    id: "a-07",
    at: t(9, 4, 6),
    kind: "DECISION",
    message: "SOL / USDT ditolak — nilai harapan di bawah minimum kebijakan.",
    decisionId: "dec-sol-reject",
  },
  {
    id: "a-08",
    at: t(9, 12, 44),
    kind: "BUSINESS",
    message: "Undangan langsung diterima: laporan margin Shopify.",
    opportunityId: "opp-shopify-reporting",
  },
  { id: "a-09", at: t(9, 16, 20), kind: "RESEARCH", message: "Riset pelanggan: riwayat rekrutmen dan ulasan broker kargo.", opportunityId: "opp-doc-automation" },
  {
    id: "a-10",
    at: t(9, 18, 2),
    kind: "DECISION",
    message: "Kejar otomasi dokumen — nilai harapan $286.",
    decisionId: "dec-doc-pursue",
  },
  {
    id: "a-11",
    at: t(9, 19, 37),
    kind: "SEARCH",
    message: "Menemukan bounty publik: perbaikan parser CSV streaming ($150).",
    opportunityId: "opp-api-bounty",
  },
  { id: "a-12", at: t(9, 23, 9), kind: "BUSINESS", message: "Proposal disusun untuk otomasi dokumen.", opportunityId: "opp-doc-automation" },
  {
    id: "a-13",
    at: t(9, 26, 51),
    kind: "ANALYSIS",
    message: "Penyimpangan funding rate ETH terdeteksi antar bursa.",
    opportunityId: "opp-funding-spread",
  },
  {
    id: "a-14",
    at: t(9, 29, 15),
    kind: "RISK",
    message: "Selisih funding dilewati: risiko counterparty di dua bursa di luar kebijakan.",
    opportunityId: "opp-funding-spread",
  },
  { id: "a-15", at: t(9, 34, 40), kind: "MONITOR", message: "Posisi ditinjau. Semua stop aman; tidak perlu penyesuaian." },
  { id: "a-16", at: t(9, 38, 22), kind: "RESEARCH", message: "Membandingkan volatilitas historis pasangan kripto utama." },
];
