import React from "react";
import {
  X,
  Ticket,
  CheckCircle2,
  User,
  Bus,
  Train,
  MapPin,
  Calendar,
  Clock,
  AlertCircle,
} from "lucide-react";

export default function TicketVerificationModal({
  isOpen,
  onClose,
  ticket,
  onVerify,
}) {
  if (!isOpen) {
    return null;
  }

  // Get ticket information safely
  const ticketNumber =
    ticket?.ticketNumber ||
    ticket?.ticketId ||
    ticket?.id ||
    "Not Available";

  const passengerName =
    ticket?.passengerName ||
    ticket?.name ||
    ticket?.passenger ||
    "Not Available";

  const vehicleType =
    ticket?.vehicleType ||
    ticket?.transportType ||
    ticket?.type ||
    "Bus";

  const source =
    ticket?.source ||
    ticket?.from ||
    ticket?.startLocation ||
    "Not Available";

  const destination =
    ticket?.destination ||
    ticket?.to ||
    ticket?.endLocation ||
    "Not Available";

  const journeyDate =
    ticket?.journeyDate ||
    ticket?.date ||
    new Date().toLocaleDateString();

  const journeyTime =
    ticket?.journeyTime ||
    ticket?.time ||
    "Not Available";

  const isVerified = ticket?.verified === true;

  const handleVerify = () => {
    if (onVerify) {
      onVerify(ticket);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "520px",
          maxHeight: "90vh",
          overflowY: "auto",
          backgroundColor: "#ffffff",
          borderRadius: "18px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 24px",
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "12px",
                backgroundColor: "#ecfdf5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ticket size={24} color="#059669" />
            </div>

            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: "20px",
                  fontWeight: "700",
                  color: "#111827",
                }}
              >
                Ticket Verification
              </h2>

              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: "13px",
                  color: "#6b7280",
                }}
              >
                Verify public transport journey
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "#f3f4f6",
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <X size={20} color="#374151" />
          </button>
        </div>

        {/* Verification status */}
        <div style={{ padding: "20px 24px 0" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "12px 14px",
              borderRadius: "10px",
              backgroundColor: isVerified ? "#ecfdf5" : "#fffbeb",
              border: `1px solid ${
                isVerified ? "#a7f3d0" : "#fde68a"
              }`,
            }}
          >
            {isVerified ? (
              <CheckCircle2 size={20} color="#059669" />
            ) : (
              <AlertCircle size={20} color="#d97706" />
            )}

            <span
              style={{
                fontSize: "14px",
                fontWeight: "600",
                color: isVerified ? "#047857" : "#b45309",
              }}
            >
              {isVerified
                ? "Ticket already verified"
                : "Ticket requires verification"}
            </span>
          </div>
        </div>

        {/* Ticket details */}
        <div style={{ padding: "20px 24px" }}>
          <h3
            style={{
              margin: "0 0 14px",
              fontSize: "16px",
              fontWeight: "700",
              color: "#111827",
            }}
          >
            Ticket Details
          </h3>

          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: "14px",
              overflow: "hidden",
            }}
          >
            {/* Ticket number */}
            <div
              style={{
                padding: "14px 16px",
                backgroundColor: "#f9fafb",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  color: "#6b7280",
                  marginBottom: "4px",
                }}
              >
                Ticket Number
              </div>

              <div
                style={{
                  fontSize: "16px",
                  fontWeight: "700",
                  color: "#111827",
                }}
              >
                {ticketNumber}
              </div>
            </div>

            {/* Passenger */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "14px 16px",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <User size={20} color="#6b7280" />

              <div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "#6b7280",
                  }}
                >
                  Passenger
                </div>

                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#111827",
                  }}
                >
                  {passengerName}
                </div>
              </div>
            </div>

            {/* Transport */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "14px 16px",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              {vehicleType.toLowerCase().includes("train") ? (
                <Train size={20} color="#6b7280" />
              ) : (
                <Bus size={20} color="#6b7280" />
              )}

              <div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "#6b7280",
                  }}
                >
                  Transport
                </div>

                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#111827",
                  }}
                >
                  {vehicleType}
                </div>
              </div>
            </div>

            {/* Route */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "14px 16px",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <MapPin size={20} color="#6b7280" />

              <div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "#6b7280",
                  }}
                >
                  Route
                </div>

                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#111827",
                  }}
                >
                  {source} → {destination}
                </div>
              </div>
            </div>

            {/* Date and time */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "14px 16px",
                  borderRight: "1px solid #e5e7eb",
                }}
              >
                <Calendar size={19} color="#6b7280" />

                <div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#6b7280",
                    }}
                  >
                    Date
                  </div>

                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#111827",
                    }}
                  >
                    {journeyDate}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "14px 16px",
                }}
              >
                <Clock size={19} color="#6b7280" />

                <div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#6b7280",
                    }}
                  >
                    Time
                  </div>

                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#111827",
                    }}
                  >
                    {journeyTime}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Green Credits information */}
        <div style={{ padding: "0 24px 20px" }}>
          <div
            style={{
              padding: "16px",
              borderRadius: "12px",
              backgroundColor: "#f0fdf4",
              border: "1px solid #bbf7d0",
            }}
          >
            <div
              style={{
                fontSize: "14px",
                fontWeight: "700",
                color: "#166534",
                marginBottom: "5px",
              }}
            >
              🌱 Green Credits
            </div>

            <div
              style={{
                fontSize: "13px",
                color: "#15803d",
                lineHeight: "1.5",
              }}
            >
              After successful verification, the passenger can receive
              Green Credits for using eco-friendly public transportation.
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div
          style={{
            display: "flex",
            gap: "12px",
            padding: "18px 24px 24px",
            borderTop: "1px solid #e5e7eb",
          }}
        >
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "12px 18px",
              borderRadius: "10px",
              border: "1px solid #d1d5db",
              backgroundColor: "#ffffff",
              color: "#374151",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>

          <button
            onClick={handleVerify}
            disabled={isVerified}
            style={{
              flex: 1,
              padding: "12px 18px",
              borderRadius: "10px",
              border: "none",
              backgroundColor: isVerified ? "#9ca3af" : "#059669",
              color: "#ffffff",
              fontSize: "14px",
              fontWeight: "600",
              cursor: isVerified ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <CheckCircle2 size={18} />

            {isVerified ? "Verified" : "Verify Ticket"}
          </button>
        </div>
      </div>
    </div>
  );
}