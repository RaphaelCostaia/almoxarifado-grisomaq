import { NovaCompraForm } from "@/components/NovaCompraForm";

export default function NovaCompraPage({
  searchParams,
}: {
  searchParams: { pedido?: string; peca?: string; qtd?: string };
}) {
  return (
    <NovaCompraForm
      pedidoId={searchParams.pedido ? Number(searchParams.pedido) : null}
      pecaIdInicial={searchParams.peca ? Number(searchParams.peca) : null}
      qtdInicial={searchParams.qtd ? Number(searchParams.qtd) : null}
    />
  );
}
