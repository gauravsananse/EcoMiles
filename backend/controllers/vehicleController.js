const Vehicle = require('../models/Vehicle');
const vehicleVerificationService = require('../services/vehicleVerificationService');
const qrService = require('../services/qrService');

// @desc    Verify Indian Vehicle RC with External API
// @route   POST /api/vehicles/verify
// @access  Public (or Protected)
exports.verifyVehicle = async (req, res) => {
  try {
    const { registrationNumber, isEV, evModel } = req.body;

    if (!registrationNumber || !registrationNumber.trim()) {
      return res.status(400).json({
        success: false,
        errorState: 'INVALID_REGISTRATION',
        error: 'Please provide a valid Indian vehicle registration number.',
      });
    }

    const cleanReg = vehicleVerificationService.normalizeRegistrationNumber(registrationNumber);

    // Check if format is valid first
    if (!vehicleVerificationService.validatePlateFormat(cleanReg)) {
      return res.status(400).json({
        success: false,
        errorState: 'INVALID_REGISTRATION',
        error: 'Invalid registration format. Use standard Indian plate format like MH12AB1234 or 22BH1234AA.',
      });
    }

    // Check if vehicle is already bound to an account in our database
    const existingVehicle = await Vehicle.findOne({
      registrationNumber: cleanReg,
      isActive: true,
    });

    if (existingVehicle) {
      const isCurrentUser = req.user && existingVehicle.userId.equals(req.user._id);
      return res.status(409).json({
        success: false,
        errorState: 'ALREADY_REGISTERED',
        error: isCurrentUser
          ? 'You have already registered and bound this vehicle to your account.'
          : 'This vehicle is already associated with another account.',
        isBoundToCaller: Boolean(isCurrentUser),
      });
    }

    // Execute RC verification via provider adapter
    const result = await vehicleVerificationService.verifyVehicleRegistration(cleanReg, { isEV, evModel });

    if (!result.success) {
      const statusCode =
        result.errorState === 'NOT_AN_EV'
          ? 422
          : result.errorState === 'VEHICLE_NOT_FOUND'
          ? 404
          : result.errorState === 'RATE_LIMITED'
          ? 429
          : result.errorState === 'VERIFICATION_UNAVAILABLE'
          ? 503
          : 400;

      return res.status(statusCode).json({
        success: false,
        errorState: result.errorState,
        error: result.message,
        vehicleData: result.vehicleData,
      });
    }

    return res.status(200).json({
      success: true,
      errorState: null,
      data: result,
    });
  } catch (error) {
    console.error('[VehicleController.verifyVehicle] Error:', error.message);
    return res.status(500).json({
      success: false,
      errorState: 'API_ERROR',
      error: 'An internal server error occurred while verifying the vehicle.',
    });
  }
};

// @desc    Register and Bind Verified EV to User Account
// @route   POST /api/vehicles/register
// @access  Private
exports.registerVehicle = async (req, res) => {
  try {
    const {
      registrationNumber,
      manufacturer,
      model,
      fuelType,
      vehicleClass,
      registrationDate,
      maskedOwnerName,
      verificationSource,
    } = req.body;

    if (!registrationNumber || !fuelType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required vehicle information for registration.',
      });
    }

    const cleanReg = vehicleVerificationService.normalizeRegistrationNumber(registrationNumber);

    // Duplicate vehicle protection: Check if registration exists across ALL users
    const existingVehicle = await Vehicle.findOne({
      registrationNumber: cleanReg,
      isActive: true,
    });

    if (existingVehicle) {
      if (existingVehicle.userId.equals(req.user._id)) {
        return res.status(400).json({
          success: false,
          errorState: 'ALREADY_REGISTERED',
          error: 'You have already registered this vehicle to your account.',
        });
      }
      // Mandatory protection: never expose other user's details
      return res.status(409).json({
        success: false,
        errorState: 'ALREADY_REGISTERED',
        error: 'This vehicle is already associated with another account.',
      });
    }

    // Verify EV classification again on server
    const evCheck = vehicleVerificationService.isElectricFuel(fuelType);
    if (!evCheck.isEV) {
      return res.status(422).json({
        success: false,
        errorState: 'NOT_AN_EV',
        error: 'Only electric vehicles can be registered in the Green Credits application.',
      });
    }

    // Generate cryptographic QR token
    const qrToken = qrService.generateSecureToken();

    // Authorized BLE identity format: GC-EV-XXXXXX
    const bleId = req.body.bluetoothIdentifier || `GC-EV-${cleanReg.slice(-4).toUpperCase()}`;

    // Create Vehicle record
    const vehicle = await Vehicle.create({
      userId: req.user._id,
      registrationNumber: cleanReg,
      vehicleType: req.body.vehicleType || 'EV',
      make: req.body.make || manufacturer || 'Electric Vehicle Maker',
      manufacturer: manufacturer || 'Electric Vehicle Maker',
      model: model || 'Model',
      fuelType: fuelType || 'ELECTRIC',
      bluetoothIdentifier: bleId,
      isVerified: true,
      vehicleClass: vehicleClass || 'Motor Vehicle (EV)',
      maskedOwnerName: maskedOwnerName || 'Registered Owner',
      registrationDate: registrationDate || 'N/A',
      verificationStatus: 'verified',
      verificationSource: verificationSource || 'National Vahan Gateway',
      verifiedAt: new Date(),
      qrToken,
      qrCreatedAt: new Date(),
      isActive: true,
    });

    // Generate QR DataURL
    const qrDataURL = await qrService.generateQRCodeDataURL(qrToken, cleanReg);

    const vehicleIdFormatted = `EV-${vehicle._id.toString().slice(-4).toUpperCase()}`;

    return res.status(201).json({
      success: true,
      message: 'EV Successfully Registered and Bound to Account',
      vehicle: {
        id: vehicle._id,
        vehicleId: vehicleIdFormatted,
        registrationNumber: vehicle.registrationNumber,
        manufacturer: vehicle.manufacturer,
        make: vehicle.make,
        model: vehicle.model,
        fuelType: vehicle.fuelType,
        bluetoothIdentifier: vehicle.bluetoothIdentifier,
        vehicleClass: vehicle.vehicleClass,
        maskedOwnerName: vehicle.maskedOwnerName,
        registrationDate: vehicle.registrationDate,
        verificationStatus: vehicle.verificationStatus,
        verificationSource: vehicle.verificationSource,
        verifiedAt: vehicle.verifiedAt,
        qrToken: vehicle.qrToken,
        qrCreatedAt: vehicle.qrCreatedAt,
        qrDataURL,
        isActive: vehicle.isActive,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        errorState: 'ALREADY_REGISTERED',
        error: 'This vehicle is already associated with another account.',
      });
    }
    console.error('[VehicleController.registerVehicle] Error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to register vehicle in database.',
    });
  }
};

// @desc    Get Current User's Registered EV
// @route   GET /api/vehicles/my-vehicle
// @access  Private
exports.getMyVehicle = async (req, res) => {
  try {
    const vehicle = await Vehicle.findOne({
      userId: req.user._id,
      isActive: true,
    }).sort({ createdAt: -1 });

    if (!vehicle) {
      return res.status(200).json({
        success: true,
        vehicle: null,
      });
    }

    const qrDataURL = await qrService.generateQRCodeDataURL(
      vehicle.qrToken,
      vehicle.registrationNumber
    );

    const vehicleIdFormatted = `EV-${vehicle._id.toString().slice(-4).toUpperCase()}`;

    return res.status(200).json({
      success: true,
      vehicle: {
        id: vehicle._id,
        vehicleId: vehicleIdFormatted,
        registrationNumber: vehicle.registrationNumber,
        manufacturer: vehicle.manufacturer,
        make: vehicle.make,
        model: vehicle.model,
        fuelType: vehicle.fuelType,
        bluetoothIdentifier: vehicle.bluetoothIdentifier,
        isVerified: vehicle.isVerified,
        vehicleClass: vehicle.vehicleClass,
        maskedOwnerName: vehicle.maskedOwnerName,
        registrationDate: vehicle.registrationDate,
        verificationStatus: vehicle.verificationStatus,
        verificationSource: vehicle.verificationSource,
        verifiedAt: vehicle.verifiedAt,
        qrToken: vehicle.qrToken,
        qrCreatedAt: vehicle.qrCreatedAt,
        qrDataURL,
        isActive: vehicle.isActive,
      },
    });
  } catch (error) {
    console.error('[VehicleController.getMyVehicle] Error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch registered vehicle.',
    });
  }
};

// @desc    Verify QR Code / Physical Vehicle Access Binding
// @route   POST /api/vehicles/qr/verify
// @access  Private
exports.verifyQR = async (req, res) => {
  try {
    const { qrToken } = req.body;

    if (!qrToken) {
      return res.status(400).json({
        success: false,
        error: 'QR token is required for physical binding verification.',
      });
    }

    // Look up vehicle by secure QR token
    const vehicle = await Vehicle.findOne({ qrToken: qrToken.trim(), isActive: true });

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        verified: false,
        error: 'Invalid, revoked, or non-existent vehicle QR code.',
      });
    }

    // Check ownership against the logged-in user
    const isOwner = vehicle.userId.equals(req.user._id);

    if (!isOwner) {
      return res.status(403).json({
        success: false,
        verified: false,
        error: '✕ This vehicle is not associated with your account.',
      });
    }

    return res.status(200).json({
      success: true,
      verified: true,
      message: '✓ Vehicle Binding Confirmed',
      vehicle: {
        vehicleId: `EV-${vehicle._id.toString().slice(-4).toUpperCase()}`,
        registrationNumber: vehicle.registrationNumber,
        manufacturer: vehicle.manufacturer,
        model: vehicle.model,
        fuelType: vehicle.fuelType,
      },
    });
  } catch (error) {
    console.error('[VehicleController.verifyQR] Error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Error verifying vehicle QR token.',
    });
  }
};

// @desc    Regenerate QR Token for Registered Vehicle
// @route   POST /api/vehicles/qr/regenerate
// @access  Private
exports.regenerateQR = async (req, res) => {
  try {
    const { vehicleId } = req.body;

    const query = vehicleId
      ? { _id: vehicleId, userId: req.user._id, isActive: true }
      : { userId: req.user._id, isActive: true };

    const vehicle = await Vehicle.findOne(query);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        error: 'No active registered vehicle found to regenerate QR code for.',
      });
    }

    // Generate fresh cryptographic token
    const newQrToken = qrService.generateSecureToken();
    vehicle.qrToken = newQrToken;
    vehicle.qrCreatedAt = new Date();
    await vehicle.save();

    const qrDataURL = await qrService.generateQRCodeDataURL(
      newQrToken,
      vehicle.registrationNumber
    );

    return res.status(200).json({
      success: true,
      message: 'QR Code regenerated successfully',
      qrToken: newQrToken,
      qrCreatedAt: vehicle.qrCreatedAt,
      qrDataURL,
    });
  } catch (error) {
    console.error('[VehicleController.regenerateQR] Error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to regenerate vehicle QR code.',
    });
  }
};

// @desc    Unlink / Deactivate Registered Vehicle
// @route   DELETE /api/vehicles/:vehicleId
// @access  Private
exports.unlinkVehicle = async (req, res) => {
  try {
    const { vehicleId } = req.params;

    const vehicle = await Vehicle.findOne({
      _id: vehicleId,
      userId: req.user._id,
    });

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle not found or you do not have permission to unlink it.',
      });
    }

    // Delete or mark inactive
    await Vehicle.findByIdAndDelete(vehicle._id);

    return res.status(200).json({
      success: true,
      message: 'Vehicle unlinked successfully from your account.',
    });
  } catch (error) {
    console.error('[VehicleController.unlinkVehicle] Error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to unlink vehicle.',
    });
  }
};
