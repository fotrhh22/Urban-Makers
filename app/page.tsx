import Dashboard from "@/components/dashboard";
import { areas, dataCoverage, districts, metadata, sources } from "@/lib/data";

export default function Home() {
  return (
    <Dashboard
      districts={districts}
      areas={areas}
      indicatorMeta={metadata}
      sourceMeta={sources}
      coverage={dataCoverage}
    />
  );
}
