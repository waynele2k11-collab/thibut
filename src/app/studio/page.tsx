import Link from "next/link";
import { Upload, MoreHorizontal, PieChart, DollarSign, Filter, ArrowUpDown } from "lucide-react";

const MOCK_DESIGNS = [
  {
    id: "1",
    title: "Whispering Bamboo",
    medium: "Scroll / Ink",
    status: "PUBLISHED",
    visibility: "Public",
    orders: 142,
    royalties: "¥ 35,500",
    imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuAUXNZ47eIfcjjco4iCY8XAlzvJdTDQYxH7BN9_FxrZ7Qn7IhzrdaDnyh9ABtDcAQz9WFtWAC7jM9j15CPUL18srQG5wpn1ToxqFBNjX78iazMm0Zd9boyDoMchAB2o85d7LU9YfEX56_SDIsxk2jUJZx6JZDSWFDKjaYIT5Srysk3mq2oy6OJQKwbMiowUmWcJaraiLNrmVG_zQDqy-dKuMDGRRiTaTguVlw9nyHzee4F8vWVROZXb",
  },
  {
    id: "2",
    title: "Autumn Mist",
    medium: "Canvas / Mixed",
    status: "DRAFT",
    visibility: "Private",
    orders: null,
    royalties: null,
    imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuCbgl7ZrHmTAPj05IHvncK2AZGByjjxW2Zn_ty080afPrpvGGEJ2UOaQ34OQSi36r6Sm4dImonlGnV3ndc0l8o7yYqas4cbooZL9es_iEkhgm8WnszEveM_QWIpUyXk6deLiOUqLHd1__GYU3kHx_DuGurzSB_eIotyUd7y_XJLwc_V-3Yq2FIFGaIXgJdi8qFo5E1r0QVLSSYl3GUk_xrA8-chVXfaI6s1zc_7am__2BOmM66JKt67",
  },
  {
    id: "3",
    title: "Modern Seal: Dragon",
    medium: "Digital / Seal",
    status: "PUBLISHED",
    visibility: "Public",
    orders: 89,
    royalties: "¥ 12,000",
    imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuCuY7C9wEB7V-XNmnhv1eh34-gj9R3im-CErrIsYk_D6mqHwZ2CwuIOmfnJtF3KWtXAlOs4q0FnN3NT7z9h9u2DSRCUf4MC2V_0SjC5hpXAZ3TvAlwsE_4FEjoiV88LzaZ0lRNTECAP4wPRNBUueP4hD4os_SFT8VMLi8GedaL2OS5_V9hlGQENl-LSUz-8uiDRe4kbXj_KoFbQ49DdvsvbC2N_QdCvR8MbEclDr5aoaeXwzKFjxxMj",
  },
];

const STATUS_STYLES: Record<string, string> = {
  PUBLISHED: "bg-surface-container-high border border-outline-variant text-primary",
  DRAFT: "bg-surface-container-low border border-surface-variant text-on-surface-variant",
  PAUSED: "bg-surface-container border border-outline-variant text-on-surface-variant",
};

export default function CreatorStudioPage() {
  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col font-body-md text-body-md antialiased relative">
      {/* Main Content */}
      <main className="flex-grow w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-12 flex flex-col gap-12 relative z-10">
        {/* Header */}
        <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
          <div className="flex flex-col gap-4 max-w-2xl">
            <h1 className="font-display-lg text-display-lg hidden md:block text-on-background">Studio Dashboard</h1>
            <h1 className="font-display-lg-mobile text-display-lg-mobile md:hidden text-on-background">Studio Dashboard</h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant">
              Manage your marketplace listings, track performance, and publish new works of art.
            </p>
          </div>
          <button className="bg-primary text-on-primary px-6 py-3 flex items-center gap-2 hover:bg-surface-tint transition-colors duration-300 font-label-caps text-label-caps uppercase">
            <Upload className="w-5 h-5" />
            Upload New Artwork
          </button>
        </section>

        {/* Metrics & Quota Bento Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
          {/* Quota Card */}
          <div className="bg-surface-container-lowest border border-surface-variant p-8 flex flex-col gap-6 col-span-1">
            <div className="flex justify-between items-start">
              <h2 className="font-headline-sm text-headline-sm text-on-background">Listing Quota</h2>
              <PieChart className="w-5 h-5 text-on-surface-variant" />
            </div>
            <div className="flex flex-col gap-2 flex-grow justify-center">
              <div className="flex items-baseline gap-2">
                <span className="font-display-lg text-display-lg text-on-background">12</span>
                <span className="font-body-md text-body-md text-on-surface-variant">/ 25 Published</span>
              </div>
              <div className="w-full bg-surface-variant h-1 mt-4 relative rounded-full">
                <div className="absolute top-0 left-0 h-full bg-primary rounded-full" style={{ width: "48%" }} />
              </div>
              <p className="font-label-caps text-label-caps text-on-surface-variant mt-2 uppercase">13 Slots Remaining</p>
            </div>
          </div>

          {/* Earnings Card */}
          <div className="bg-surface-container-lowest border border-surface-variant p-8 flex flex-col gap-6 col-span-1 md:col-span-2 relative overflow-hidden group">
            <div className="absolute inset-0 z-0">
              <img
                className="w-full h-full object-cover opacity-20 grayscale transition-transform duration-1000 group-hover:scale-105"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDCTgMfnrchTlvv-KOlSb1nZCxH52sUORClsu3QyWLSaGi2BhplcEj2eVyr4X6oujFuPu0jLwcA8mKyCbU5s50qzxs14IFOer_DSafmwaBZStLUcdra3HcRgCH446Wv2jS8aVObVmchMuSm25B3oi-lJb0rJ1JvGs9CuJhzxV6kqVqUvxYeY86CRj1WSBJERl4WsHNuvKgStw08s6f4ANAQdfLU5jHxXpCp5Dw9eh-hnwgBEVU1d31R"
                alt=""
              />
            </div>
            <div className="relative z-10 flex justify-between items-start">
              <h2 className="font-headline-sm text-headline-sm text-on-background">Lifetime Royalties</h2>
              <DollarSign className="w-5 h-5 text-on-surface-variant" />
            </div>
            <div className="relative z-10 flex flex-col gap-2 flex-grow justify-center">
              <span className="font-display-lg text-display-lg hidden md:block text-on-background">¥ 1,250,000</span>
              <span className="font-display-lg-mobile text-display-lg-mobile md:hidden text-on-background">¥ 1,250K</span>
              <p className="font-body-md text-body-md text-on-surface-variant">+¥ 45,000 this month</p>
            </div>
          </div>
        </section>

        {/* Design Table */}
        <section className="flex flex-col gap-8">
          <div className="flex justify-between items-center border-b border-surface-variant pb-4">
            <h2 className="font-headline-md text-headline-md text-on-background">Your Designs</h2>
            <div className="flex gap-4">
              <button className="text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1">
                <Filter className="w-4 h-4" />
                <span className="font-label-caps text-label-caps uppercase hidden md:inline">Filter</span>
              </button>
              <button className="text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1">
                <ArrowUpDown className="w-4 h-4" />
                <span className="font-label-caps text-label-caps uppercase hidden md:inline">Sort</span>
              </button>
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-surface-variant">
                  <th className="py-4 px-4 font-label-caps text-label-caps text-on-surface-variant uppercase font-medium">Artwork</th>
                  <th className="py-4 px-4 font-label-caps text-label-caps text-on-surface-variant uppercase font-medium">Status</th>
                  <th className="py-4 px-4 font-label-caps text-label-caps text-on-surface-variant uppercase font-medium">Visibility</th>
                  <th className="py-4 px-4 font-label-caps text-label-caps text-on-surface-variant uppercase font-medium text-right">Orders</th>
                  <th className="py-4 px-4 font-label-caps text-label-caps text-on-surface-variant uppercase font-medium text-right">Royalties</th>
                  <th className="py-4 px-4 font-label-caps text-label-caps text-on-surface-variant uppercase font-medium text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_DESIGNS.map((design) => (
                  <tr key={design.id} className="border-b border-surface-variant hover:bg-surface-container-low transition-colors">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-surface-container border border-surface-variant overflow-hidden flex-shrink-0">
                          <img className="w-full h-full object-cover" src={design.imageUrl} alt={design.title} />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-body-md text-body-md font-medium text-on-background">{design.title}</span>
                          <span className="font-label-caps text-label-caps text-on-surface-variant mt-1">{design.medium}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className={`inline-flex items-center px-2 py-1 ${STATUS_STYLES[design.status]}`}>
                        <span className="font-label-caps text-label-caps uppercase">{design.status}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-on-surface-variant font-body-md">{design.visibility}</td>
                    <td className="py-4 px-4 text-right font-body-md text-on-background">{design.orders ?? "—"}</td>
                    <td className="py-4 px-4 text-right font-body-md text-on-background">{design.royalties ?? "—"}</td>
                    <td className="py-4 px-4 text-center">
                      <button className="text-on-surface-variant hover:text-primary transition-colors p-2">
                        <MoreHorizontal className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-center mt-4">
            <button className="text-primary border-b border-primary pb-1 font-label-caps text-label-caps uppercase hover:text-surface-tint transition-colors">
              View All Designs
            </button>
          </div>
        </section>

        {/* Permissions Drawer */}
        <section className="flex flex-col gap-6 border border-surface-variant p-8 bg-surface-container-lowest">
          <div className="border-b border-surface-variant pb-4">
            <h2 className="font-headline-md text-headline-md text-on-background">Default Personalization Permissions</h2>
            <p className="font-body-md text-body-md text-on-surface-variant mt-2">Control what buyers can customize on your artwork by default. These can be overridden per design.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { label: "Allow Name", description: "Buyer can add their name", defaultOn: true },
              { label: "Allow Quote", description: "Buyer can add a quote", defaultOn: true },
              { label: "Allow Translation", description: "Platform translates buyer text", defaultOn: true },
              { label: "Allow Calligraphy Style", description: "Buyer can choose style pack", defaultOn: true },
              { label: "Allow AI Restyle", description: "AI can restyle your artwork", defaultOn: false },
              { label: "Allow Model Training", description: "Use artwork for AI training", defaultOn: false },
            ].map((perm) => (
              <div key={perm.label} className="flex items-start justify-between gap-4 p-4 border border-surface-variant bg-surface rounded">
                <div>
                  <p className="font-body-md text-body-md font-medium text-on-background">{perm.label}</p>
                  <p className="font-label-caps text-label-caps text-on-surface-variant mt-1">{perm.description}</p>
                </div>
                <div
                  className={`flex-shrink-0 w-10 h-6 rounded-full transition-colors duration-300 relative cursor-pointer ${
                    perm.defaultOn ? "bg-primary" : "bg-surface-container-highest"
                  }`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 rounded-full bg-on-primary shadow transition-transform duration-300 ${
                      perm.defaultOn ? "translate-x-5" : "translate-x-1"
                    }`}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-surface-container-low border-t border-surface-variant">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter px-margin-mobile md:px-margin-desktop py-16 max-w-container-max mx-auto">
          <div className="flex flex-col gap-4">
            <span className="font-headline-sm text-headline-sm text-on-background">Thi Bút</span>
            <p className="font-body-md text-body-md text-on-surface-variant">© 2026 Thi Bút Marketplace. Preserving the art of the brush.</p>
          </div>
          <nav className="flex flex-wrap gap-x-8 gap-y-4 md:justify-end items-start">
            {["Cultural Guide", "Legal", "Licensing", "Artist Terms", "Support"].map((link) => (
              <Link key={link} href="#" className="text-on-surface-variant hover:text-primary font-label-caps text-label-caps uppercase opacity-80 hover:opacity-100 transition-all">
                {link}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
