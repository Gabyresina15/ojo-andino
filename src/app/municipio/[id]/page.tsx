import { notFound } from "next/navigation";
import { COMUNIDADES, getComunidad } from "@/lib/comunidades";
import ExpedienteMunicipal from "@/components/ExpedienteMunicipal";

export function generateStaticParams() {
  return COMUNIDADES.map((c) => ({ id: c.id }));
}

export default async function MunicipioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const comunidad = getComunidad(id);
  if (!comunidad) notFound();
  return <ExpedienteMunicipal comunidad={comunidad} />;
}
