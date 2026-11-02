export default {
  expo: {
    name: "Smart Waste",
    slug: "smart-waste",
    owner: "maykiddd",
    version: "1.0.0",
    scheme: "smartwaste",
    orientation: "portrait",
    userInterfaceStyle: "light",
    android: {
      package: "id.smartwaste.assessment",
      versionCode: 1,
      permissions: ["ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION", "CAMERA"],
    },
    plugins: [
      "expo-secure-store",
      [
        "expo-image-picker",
        {
          photosPermission: "Pilih foto sampah untuk laporan Anda.",
          cameraPermission: "Ambil foto sampah untuk laporan Anda.",
          microphonePermission: false,
        },
      ],
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "Gunakan lokasi penemuan sampah saat Anda membuat laporan.",
        },
      ],
    ],
    extra: {
      eas: { projectId: "4e3d9447-b2c0-4d29-b6d0-0e144dd086c7" },
    },
  },
};
