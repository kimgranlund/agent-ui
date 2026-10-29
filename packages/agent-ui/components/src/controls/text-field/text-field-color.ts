// text-field-color.ts: the type=color leg's lazy kit (T-0527). text-field.ts loads this module on first
// color use only, so a field that never takes type=color ships neither the OKLCH codec (color.ts) nor
// ui-swatch. The color-picker CONTROL stays its own later dynamic import, on the swatch button's first click.
import '../swatch/swatch.ts' // registers ui-swatch: the swatch-button preview upgrades in place
export { colorCodecOptions } from '../color-picker/color.ts'
