import edwardMain from "../../assets/pastors/edward-morales.webp";
import edwardProfile from "../../assets/pastors/edward-morales-profile.webp";
import edwardTwo from "../../assets/pastors/edward-morales-2.webp";
import edwardThree from "../../assets/pastors/edward-morales-3.webp";
import edwardFour from "../../assets/pastors/edward-morales-4.webp";
import enricoMain from "../../assets/pastors/enrico-gustilo.webp";
import enricoTwo from "../../assets/pastors/enrico-gustilo-2.webp";
import enricoThree from "../../assets/pastors/enrico-gustilo-3.webp";
import enricoFour from "../../assets/pastors/enrico-gustilo-4.webp";
import victorinoMain from "../../assets/pastors/victorino-calma.webp";
import victorinoTwo from "../../assets/pastors/victorino-calma-2.webp";
import victorinoThree from "../../assets/pastors/victorino-calma-3.webp";
import victorinoFour from "../../assets/pastors/victorino-calma-4.webp";

export type PastorProfile = { slug: string; name: string; photo: string; profilePhoto?: string; additionalPhotos: string[] };

export const pastors: PastorProfile[] = [
  { slug: "edward-morales", name: "Pastor Edward Morales", photo: edwardMain, profilePhoto: edwardProfile, additionalPhotos: [edwardTwo, edwardThree, edwardFour] },
  { slug: "enrico-gustilo", name: "Pastor Enrico Gustilo", photo: enricoMain, additionalPhotos: [enricoTwo, enricoThree, enricoFour] },
  { slug: "victorino-calma", name: "Pastor Victorino Calma", photo: victorinoMain, additionalPhotos: [victorinoTwo, victorinoThree, victorinoFour] },
];

export function findPastor(slug: string | undefined) { return pastors.find((pastor) => pastor.slug === slug); }
