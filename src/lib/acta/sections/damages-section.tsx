import { View, Text } from "@react-pdf/renderer";
import { styles } from "../styles";
import { ActaCroquis } from "../components/croquis";
import type { ActaData } from "../types";

/**
 * El croquis se muestra siempre que haya algún daño activo del auto —
 * preexistente o nuevo de esta inspección —, no solo cuando esta
 * entrega/devolución encontró algo nuevo: es el registro visual del estado
 * real del auto, no solo de lo cargado en esta inspección puntual.
 */
export function DamagesSection({ data }: { data: ActaData }) {
  const t = data.dict.acta;
  const hasAny = data.damages.length > 0 || data.existingDamages.length > 0;
  return (
    <View style={styles.section} wrap={false}>
      <Text style={styles.sectionTitle}>{t.damages}</Text>
      {!hasAny ? (
        <Text style={styles.label}>Sin daños registrados.</Text>
      ) : (
        <View style={styles.damagesWrap}>
          <View style={styles.croquisBox}>
            <ActaCroquis damages={data.damages} existingDamages={data.existingDamages} />
          </View>
          <View style={styles.damagesList}>
            {data.existingDamages.length > 0 && (
              <>
                <Text>{t.existingDamages}:</Text>
                {data.existingDamages.map((d, i) => (
                  <Text key={`e${i}`}>• {d.description ? d.description : `Daño (${d.view})`}</Text>
                ))}
              </>
            )}
            {data.damages.length > 0 && (
              <>
                <Text>{t.newDamages}:</Text>
                {data.damages.map((d, i) => (
                  <Text key={i}>• {d.description ? d.description : `Daño (${d.view})`}</Text>
                ))}
              </>
            )}
          </View>
        </View>
      )}
    </View>
  );
}
