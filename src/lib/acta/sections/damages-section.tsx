import { View, Text } from "@react-pdf/renderer";
import { styles } from "../styles";
import { ActaCroquis } from "../components/croquis";
import type { ActaData } from "../types";

export function DamagesSection({ data }: { data: ActaData }) {
  const t = data.dict.acta;
  return (
    <View style={styles.section} wrap={false}>
      <Text style={styles.sectionTitle}>{t.damages}</Text>
      {data.damages.length === 0 ? (
        <Text style={styles.label}>Sin daños nuevos registrados.</Text>
      ) : (
        <View style={styles.damagesWrap}>
          <View style={styles.croquisBox}>
            <ActaCroquis damages={data.damages} />
          </View>
          <View style={styles.damagesList}>
            {data.damages.map((d, i) => (
              <Text key={i}>• {d.description ? d.description : `Daño (${d.view})`}</Text>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
