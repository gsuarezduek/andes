import { View, Text } from "@react-pdf/renderer";
import { styles } from "../styles";
import type { ActaData } from "../types";

export function ComparisonSection({ data }: { data: ActaData }) {
  const t = data.dict.acta;
  if (!data.comparison) return null;
  const c = data.comparison;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Comparación con la entrega</Text>
      <View style={styles.grid2}>
        <View style={styles.cell}>
          <Text style={styles.label}>{t.kmDriven}</Text>
          <Text style={styles.value}>{c.kmDriven.toLocaleString()} km</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.label}>{t.mileage}</Text>
          <Text style={styles.value}>
            {c.handoverKm.toLocaleString()} → {c.returnKm.toLocaleString()}
          </Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.label}>{t.fuelDifference}</Text>
          <Text style={styles.value}>
            {c.handoverFuel}/{data.fuelLevels} → {c.returnFuel}/{data.fuelLevels}
          </Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.label}>{t.newDamages}</Text>
          <Text style={c.newDamages > 0 ? styles.fail : styles.value}>
            {c.newDamages}
          </Text>
        </View>
      </View>
    </View>
  );
}
