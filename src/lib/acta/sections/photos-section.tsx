import { View, Text, Image } from "@react-pdf/renderer";
import { styles } from "../styles";
import type { ActaData } from "../types";

export function PhotosSection({ data }: { data: ActaData }) {
  if (data.photoDataUris.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Fotos</Text>
      <View style={styles.photos}>
        {data.photoDataUris.map((src, i) => (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image key={i} src={src} style={styles.photo} />
        ))}
      </View>
    </View>
  );
}
