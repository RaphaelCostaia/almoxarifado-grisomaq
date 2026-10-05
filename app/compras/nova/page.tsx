import { NovaCompraForm } from "@/components/NovaCompraForm";

export default function NovaCompraPage({
  searchParams,
}: {
  searchParams: {
    pedido?: string;
    peca?: string;
    qtd?: string;
    item?: string;
  };
}) {
  return (
    <NovaCompraForm
      pedidoId={searchParams.pedido ? Number(searchParams.pedido) : null}
      pedidoItemIdInicial={
        searchParams.item ? Number(searchParams.item) : null
      }
      pecaIdInicial={searchParams.peca ? Number(searchParams.peca) : null}
      qtdInicial={searchParams.qtd ? Number(searchParams.qtd) : null}
    />
  );
}
