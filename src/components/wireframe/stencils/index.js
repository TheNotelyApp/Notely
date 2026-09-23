import { CATEGORIES } from "./categories.js";
import { shellStencils } from "./shells.js";
import { layoutStencils } from "./layouts.js";
import { fontawesomeStencils } from "./fontawesome.js";
import { thingworxStencils } from "./thingworx.js";
import { frameStencils } from "./frames.js";
import { headerStencils } from "./headers.js";
import { heroStencils } from "./hero.js";
import { contentStencils } from "./content.js";
import { metricStencils } from "./metrics.js";
import { uiStencils } from "./ui.js";
import { formStencils } from "./forms.js";
import { tableStencils } from "./tables.js";
import { feedbackStencils } from "./feedback.js";

export { CATEGORIES };

export const WIREFRAME_STENCILS = [
  ...shellStencils,
  ...layoutStencils,
  ...fontawesomeStencils,
  ...thingworxStencils,
  ...frameStencils,
  ...headerStencils,
  ...heroStencils,
  ...contentStencils,
  ...metricStencils,
  ...uiStencils,
  ...formStencils,
  ...tableStencils,
  ...feedbackStencils
];

export default WIREFRAME_STENCILS;
