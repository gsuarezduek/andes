import { View, Text } from "@react-pdf/renderer";
import { styles } from "../styles";
import type { ActaData } from "../types";

export function VehicleStateSection({ data }: { data: ActaData }) {
  const t = data.dict.acta;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t.vehicleStateTitle}</Text>
      <View style={styles.grid2}>
        <View style={styles.cell}>
          <Text style={styles.label}>{t.vehicle}</Text>
          <Text style={styles.value}>{data.vehicleLabel}</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.label}>{t.plate}</Text>
          <Text style={styles.value}>{data.plate}</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.label}>{t.mileage}</Text>
          <Text style={styles.value}>{data.km.toLocaleString()} km</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.label}>{t.fuelLevel}</Text>
          <Text style={styles.value}>{data.fuelLevel}/{data.fuelLevels}</Text>
        </View>
      </View>
    </View>
  );
}
