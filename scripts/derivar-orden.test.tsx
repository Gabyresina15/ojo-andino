import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import PanelAlerta from "../src/components/PanelAlerta";
import { lecturaCacheada } from "../src/lib/cache";
import { getComunidad } from "../src/lib/comunidades";

test("Derivar Orden no ofrece un borrador antes de conocer el origen del expediente", () => {
  const comunidad = getComunidad("susques")!;
  const html = renderToStaticMarkup(
    <PanelAlerta comunidad={comunidad} lectura={lecturaCacheada(comunidad.id)} />,
  );
  const accion = html.match(/<a\b([^>]*)>(?:(?!<\/a>)[\s\S])*Derivar Orden al Municipio/);

  assert.ok(accion, "La acción debe estar visible con la lectura en caché");
  assert.doesNotMatch(accion[1], /\bhref=/, "El servidor no debe ofrecer un borrador sin enlace");
  assert.match(accion[1], /\baria-disabled="true"/);
});
