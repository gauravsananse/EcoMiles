const BaseVehicleVerificationProvider = require('./BaseProvider');

/**
 * Official Sandbox / Development Testbed Provider
 * Used strictly when VEHICLE_API_PROVIDER=sandbox is explicitly enabled in .env
 * for local development and integration testing.
 */
class DevelopmentSandboxProvider extends BaseVehicleVerificationProvider {
  constructor() {
    super('Development Sandbox');
  }

  isConfigured() {
    return true;
  }

  async verify(registrationNumber) {
    // Artificial small network latency simulation (250ms)
    await new Promise((resolve) => setTimeout(resolve, 250));

    const cleanReg = registrationNumber.toUpperCase().replace(/[\s-]/g, '');

    // Dataset of test vehicles strictly for sandbox validation & edge cases
    const sandboxRegistry = {
      // User's Real Bajaj Chetak EV Test Case
      'MH20HK3845': {
        registrationNumber: 'MH20HK3845',
        ownerName: 'GAURAV SANANSE',
        manufacturer: 'BAJAJ AUTO LIMITED',
        model: 'CHETAK PREMIUM (EV)',
        fuelType: 'ELECTRIC',
        vehicleClass: 'Two Wheeler (2W-EV)',
        registrationDate: '2023-09-12',
      },
      // User's Real Scooty Petrol Test Case
      'MH20GM9645': {
        registrationNumber: 'MH20GM9645',
        ownerName: 'GAURAV SANANSE',
        manufacturer: 'HONDA MOTORCYCLE AND SCOOTER INDIA',
        model: 'ACTIVA 6G (BS-VI)',
        fuelType: 'PETROL',
        vehicleClass: 'Two Wheeler (Scooter - Non-EV)',
        registrationDate: '2022-06-18',
      },
      // Other EV test cases
      'MH12AB1234': {
        registrationNumber: 'MH12AB1234',
        ownerName: 'GAURAV SHARMA',
        manufacturer: 'ATHER ENERGY PRIVATE LIMITED',
        model: 'ATHER 450X GEN 3',
        fuelType: 'ELECTRIC',
        vehicleClass: 'Two Wheeler (2W-EV)',
        registrationDate: '2023-04-14',
      },
      'DL01EV9999': {
        registrationNumber: 'DL01EV9999',
        ownerName: 'PRIYA NAIR',
        manufacturer: 'TATA MOTORS PASSENGER VEHICLES LTD',
        model: 'NEXON EV MAX EMPOWERED',
        fuelType: 'ELECTRIC',
        vehicleClass: 'Motor Car (4W-EV)',
        registrationDate: '2023-11-20',
      },
      'KA03EV5678': {
        registrationNumber: 'KA03EV5678',
        ownerName: 'ARJUN REDDY',
        manufacturer: 'OLA ELECTRIC MOBILITY LTD',
        model: 'OLA S1 PRO GEN 2',
        fuelType: 'ELECTRIC',
        vehicleClass: 'Two Wheeler (2W-EV)',
        registrationDate: '2024-01-10',
      },
      'TS09EV1024': {
        registrationNumber: 'TS09EV1024',
        ownerName: 'VIKRAM VARMA',
        manufacturer: 'MG MOTOR INDIA PVT LTD',
        model: 'MG ZS EV EXCLUSIVE',
        fuelType: 'BATTERY OPERATED VEHICLE (BOV)',
        vehicleClass: 'Motor Car (4W-EV)',
        registrationDate: '2022-09-18',
      },
      // Non-EV test cases to verify rejection logic
      'MH14XY5678': {
        registrationNumber: 'MH14XY5678',
        ownerName: 'RAHUL DESHMUKH',
        manufacturer: 'MARUTI SUZUKI INDIA LTD',
        model: 'SWIFT VXI',
        fuelType: 'PETROL',
        vehicleClass: 'Motor Car (Non-EV)',
        registrationDate: '2021-02-15',
      },
      'DL04CD4321': {
        registrationNumber: 'DL04CD4321',
        ownerName: 'ANITA VERMA',
        manufacturer: 'HYUNDAI MOTOR INDIA LTD',
        model: 'CRETA SX DIESEL',
        fuelType: 'DIESEL',
        vehicleClass: 'Motor Car (Non-EV)',
        registrationDate: '2020-07-22',
      },
    };

    if (sandboxRegistry[cleanReg]) {
      const match = sandboxRegistry[cleanReg];
      return {
        success: true,
        verified: true,
        registrationNumber: match.registrationNumber,
        ownerName: match.ownerName,
        manufacturer: match.manufacturer,
        model: match.model,
        fuelType: match.fuelType,
        vehicleClass: match.vehicleClass,
        registrationDate: match.registrationDate,
        verificationSource: 'DEVELOPMENT / SANDBOX MODE (Vahan Testbed)',
        isSandboxMode: true,
      };
    }

    return {
      success: false,
      notFound: true,
      message: `Vehicle registration number ${cleanReg} was not found in the Sandbox database. (Use MH20HK3845 for Bajaj Chetak EV, MH20GM9645 for Honda Activa Petrol, or MH12AB1234 for Ather EV)`,
    };
  }
}

module.exports = DevelopmentSandboxProvider;
