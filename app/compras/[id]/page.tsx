import { CompraDetalhe } from "@/components/CompraDetalhe";

export default function Page({ params }: { params: { id: string } }) {
  return <CompraDetalhe id={Number(params.id)} />;
}
