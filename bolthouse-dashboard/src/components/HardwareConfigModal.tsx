import { useEffect, useRef, useState } from "react";
import { Cpu, X, AlertTriangle } from "lucide-react";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Switch } from "./ui/switch";
import {
  getModbusMap,
  updateModbusMap,
  getTimingConfig,
  updateTimingConfig,
  ModbusMap,
  TimingConfig,
} from "../api/modbusConfig";
import {
  getHardwareConfig,
  updateHardwareConfig,
  HardwareConfig,
  HardwareMode,
  SolenoidBackendType,
} from "../api/hardwareConfig";

type Mode = HardwareMode;

export function HardwareConfigModal() {
  const [open, setOpen] = useState(false);

  const [mode, setMode] = useState<Mode>("direct");

  const [solenoidBackend, setSolenoidBackend] =
    useState<SolenoidBackendType>("null");
  const [gpioPin, setGpioPin] = useState<number>(17);
  const [gpioActiveHigh, setGpioActiveHigh] = useState(true);
  const [usbVendorId, setUsbVendorId] = useState<number>(5024);
  const [usbProductId, setUsbProductId] = useState<number>(1503);
  const [usbOnPayload, setUsbOnPayload] = useState<string>("0,1,2,3");
  const [usbOffPayload, setUsbOffPayload] = useState<string>("0,1,2,4");

  const [simHost, setSimHost] = useState("0.0.0.0");
  const [simPort, setSimPort] = useState<number>(1502);
  const [plcHost, setPlcHost] = useState("127.0.0.1");
  const [plcPort, setPlcPort] = useState<number>(502);
  
 const [initialMode, setInitialMode] = useState<Mode>("direct"); 
  const [initialSolenoidBackend, setInitialSolenoidBackend] =      
    useState<SolenoidBackendType>("null");                        
  const [initialGpioPin, setInitialGpioPin] =                    
    useState<number>(17);                                       
  const [initialGpioActiveHigh, setInitialGpioActiveHigh] =    
    useState(true);                                           
  const [initialUsbVendorId, setInitialUsbVendorId] =        
    useState<number>(5024);                                 
  const [initialUsbProductId, setInitialUsbProductId] =    
    useState<number>(1503);                               
  const [initialUsbOnPayload, setInitialUsbOnPayload] =  
    useState<string>("0,1,2,3");                        
  const [initialUsbOffPayload, setInitialUsbOffPayload] =     
    useState<string>("0,1,2,4");                             
  const [initialSimHost, setInitialSimHost] =               
    useState("0.0.0.0");                                   
  const [initialSimPort, setInitialSimPort] =             
    useState<number>(1502);                              
  const [initialPlcHost, setInitialPlcHost] =           
    useState("127.0.0.1");                             
  const [initialPlcPort, setInitialPlcPort] =         
    useState<number>(502);                           

  const [modbusMap, setModbusMap] = useState<ModbusMap | null>(null);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [savingMap, setSavingMap] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [timingConfig, setTimingConfig] = useState<TimingConfig | null>(null);
  const [timingLoading, setTimingLoading] = useState(false);
  const [timingError, setTimingError] = useState<string | null>(null);
  const [savingTiming, setSavingTiming] = useState(false);
  const [hardwareError, setHardwareError] = useState<string | null>(null);
  const [savingHardware, setSavingHardware] = useState(false);

  const [initialModbusMap, setInitialModbusMap] = useState<ModbusMap | null>( 
    null, 
  ); 
  const [initialTimingConfig, setInitialTimingConfig] = 
    useState<TimingConfig | null>(null); 

  const [timingSaveSuccess, setTimingSaveSuccess] = useState(false);

  const [activeTab, setActiveTab] = useState<"modbus" | "timing">("modbus");

  const panelRef = useRef<HTMLDivElement | null>(null);
  const wasOpenRef = useRef(false); 

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setInitialMode(mode); 
      setInitialSolenoidBackend(solenoidBackend); 
      setInitialGpioPin(gpioPin); 
      setInitialGpioActiveHigh(gpioActiveHigh); 
      setInitialUsbVendorId(usbVendorId); 
      setInitialUsbProductId(usbProductId); 
      setInitialUsbOnPayload(usbOnPayload); 
      setInitialUsbOffPayload(usbOffPayload);
      setInitialSimHost(simHost); 
      setInitialSimPort(simPort); 
      setInitialPlcHost(plcHost); 
      setInitialPlcPort(plcPort); 
    } 
    wasOpenRef.current = open;
  }, [
    open,
    mode,
    solenoidBackend,
    gpioPin,
    gpioActiveHigh,
    usbVendorId,
    usbProductId,
    usbOnPayload,
    usbOffPayload,
    simHost,
    simPort,
    plcHost,
    plcPort,
  ]); 
  
  

  const revertUnsavedChanges = () => {
   
    setMode(initialMode);
    setSolenoidBackend(initialSolenoidBackend); 
    setGpioPin(initialGpioPin); 
    setGpioActiveHigh(initialGpioActiveHigh); 
    setUsbVendorId(initialUsbVendorId); 
    setUsbProductId(initialUsbProductId); 
    setUsbOnPayload(initialUsbOnPayload); 
    setUsbOffPayload(initialUsbOffPayload); 
    setSimHost(initialSimHost); 
    setSimPort(initialSimPort); 
    setPlcHost(initialPlcHost); 
    setPlcPort(initialPlcPort); 

    if (initialModbusMap) {
      setModbusMap(initialModbusMap);
      setSaveError(null);
      setSaveSuccess(false);
    }
    if (initialTimingConfig) {
      setTimingConfig(initialTimingConfig);
      setTimingError(null);
      setTimingSaveSuccess(false);
    }
    setActiveTab("modbus");
  };
  
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!panelRef.current) return;
      if (!panelRef.current.contains(e.target as Node)) {
        revertUnsavedChanges();
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open, revertUnsavedChanges]);

  const parseNonNegativeAddress = (raw: string, previous: number): number => {
    if (raw === "") return NaN;
    if (!/^\d+$/.test(raw)) return previous;
    const n = Number(raw);
    if (n < 0) return 0;
    return n;
  };

  const applyHardwareConfig = (config: HardwareConfig) => {
    setMode(config.mode);
    setSolenoidBackend(config.solenoid_backend);
    setGpioPin(config.gpio_pin);
    setGpioActiveHigh(config.gpio_active_high);
    setUsbVendorId(config.usb_vendor_id);
    setUsbProductId(config.usb_product_id);
    setUsbOnPayload(config.usb_on_payload.join(","));
    setUsbOffPayload(config.usb_off_payload.join(","));
    setSimHost(config.sim_host);
    setSimPort(config.sim_port);
    setPlcHost(config.plc_host);
    setPlcPort(config.plc_port);

    setInitialMode(config.mode);
    setInitialSolenoidBackend(config.solenoid_backend);
    setInitialGpioPin(config.gpio_pin);
    setInitialGpioActiveHigh(config.gpio_active_high);
    setInitialUsbVendorId(config.usb_vendor_id);
    setInitialUsbProductId(config.usb_product_id);
    setInitialUsbOnPayload(config.usb_on_payload.join(","));
    setInitialUsbOffPayload(config.usb_off_payload.join(","));
    setInitialSimHost(config.sim_host);
    setInitialSimPort(config.sim_port);
    setInitialPlcHost(config.plc_host);
    setInitialPlcPort(config.plc_port);
  };

  const parseBytePayload = (raw: string): number[] =>
    raw
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value >= 0 && value <= 255)
      .map((value) => Math.trunc(value));

  const resetToSafeMode = () => {
    setMode("direct");
    setSolenoidBackend("null");
    setGpioPin(17);
    setGpioActiveHigh(true);
    setUsbVendorId(5024);
    setUsbProductId(1503);
    setUsbOnPayload("0,1,2,3");
    setUsbOffPayload("0,1,2,4");
  };

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setHardwareError(null);

    getHardwareConfig()
      .then((config) => {
        if (cancelled) return;
        applyHardwareConfig(config);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setHardwareError(
          err instanceof Error ? err.message : "Failed to load hardware config",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (mode !== "simulator" && mode !== "openplc") return;

    let cancelled = false;
    setMapLoading(true);
    setMapError(null);
    setSaveSuccess(false);
    setSaveError(null);

    getModbusMap()
      .then((data) => {
        if (cancelled) return;
        setInitialModbusMap(data);
        setModbusMap(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setMapError(
          err instanceof Error ? err.message : "Failed to load Modbus map",
        );
      })
      .finally(() => {
        if (cancelled) return;
        setMapLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, mode]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setTimingLoading(true);
    setTimingError(null);
    setTimingSaveSuccess(false);

    getTimingConfig()
      .then((cfg) => {
        if (cancelled) return;
        setInitialTimingConfig(cfg);
        setTimingConfig(cfg);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setTimingError(
          err instanceof Error ? err.message : "Failed to load timing config",
        );
      })
      .finally(() => {
        if (cancelled) return;
        setTimingLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const showAddressMap = !!modbusMap;

  const handleSaveModbusMap = () => {
    setSaveError(null);
    setSaveSuccess(false);

    if (!modbusMap) {
      setOpen(false);
      return;
    }

    const hasBlank =
      Object.values(modbusMap.coils).some((v) => Number.isNaN(v)) ||
      Object.values(modbusMap.discrete_inputs).some((v) => Number.isNaN(v)) ||
      Object.values(modbusMap.holding_registers).some((v) =>
        Number.isNaN(v),
      ) ||
      modbusMap.holding_registers_many.some((b) => Number.isNaN(b.address));

    if (hasBlank) {
      setSaveError("All Modbus addresses must be filled in before saving.");
      return;
    }

    setSavingMap(true);

    const payload = {
      coils: modbusMap.coils,
      discrete_inputs: modbusMap.discrete_inputs,
      holding_registers: modbusMap.holding_registers,
      holding_registers_many: modbusMap.holding_registers_many.map((b) => ({
        name: b.name,
        address: b.address,
      })),
    };

    updateModbusMap(payload)
      .then((updated) => {
        setModbusMap(updated);
        setInitialModbusMap(updated);
        setSaveSuccess(true);
      })
      .catch((err: unknown) => {
        setSaveError(
          err instanceof Error ? err.message : "Failed to save Modbus map",
        );
      })
      .finally(() => {
        setSavingMap(false);
      });
  };

  const handleSaveTiming = () => {
    if (!timingConfig) return;
    setTimingError(null);
    setTimingSaveSuccess(false);
    setSavingTiming(true);

    updateTimingConfig(timingConfig)
      .then((updated) => {
        setTimingConfig(updated);
        setInitialTimingConfig(updated);
        setTimingSaveSuccess(true);
      })
      .catch((err: unknown) => {
        setTimingError(
          err instanceof Error ? err.message : "Failed to save timing config",
        );
      })
      .finally(() => {
        setSavingTiming(false);
      });
  };

  const handleSaveHardwareConfig = () => {
    setHardwareError(null);
    setSavingHardware(true);

    updateHardwareConfig({
      mode,
      solenoid_backend: solenoidBackend,
      gpio_pin: gpioPin,
      gpio_active_high: gpioActiveHigh,
      usb_vendor_id: usbVendorId,
      usb_product_id: usbProductId,
      usb_on_payload: parseBytePayload(usbOnPayload),
      usb_off_payload: parseBytePayload(usbOffPayload),
      sim_host: simHost,
      sim_port: simPort,
      plc_host: plcHost,
      plc_port: plcPort,
    })
      .then((config) => {
        applyHardwareConfig(config);
      })
      .catch((err: unknown) => {
        setHardwareError(
          err instanceof Error ? err.message : "Failed to save hardware config",
        );
      })
      .finally(() => {
        setSavingHardware(false);
      });
  };

  const handleSaveAll = () => {
    handleSaveHardwareConfig();

    if (showAddressMap) {                                  
      handleSaveModbusMap();                                
    }
    handleSaveTiming();                                   
  };
  

  const handleCloseWithoutSaving = () => { 
    revertUnsavedChanges(); 
    setOpen(false); 
  }; // changed
 
  const handleTabChangeToTiming = () => { 
    if (activeTab === "modbus") {                           
      setMode(initialMode);                               
      setSolenoidBackend(initialSolenoidBackend);        
      setGpioPin(initialGpioPin);                       
      setGpioActiveHigh(initialGpioActiveHigh);        
      setUsbVendorId(initialUsbVendorId);             
      setUsbProductId(initialUsbProductId);          
      setUsbOnPayload(initialUsbOnPayload);         
      setUsbOffPayload(initialUsbOffPayload);      
      setSimHost(initialSimHost);                 
      setSimPort(initialSimPort);                
      setPlcHost(initialPlcHost);               
      setPlcPort(initialPlcPort);              

      if (initialModbusMap) {                            
        setModbusMap(initialModbusMap);                 
        setSaveError(null);                            
        setSaveSuccess(false);                        
      }                                              
    }                                               
    setActiveTab("timing"); 
  };
  

  const handleTabChangeToModbus = () => { 
    setActiveTab("modbus"); 
  }; 

  return (
    <>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {                
            if (open) {                  
              revertUnsavedChanges();   
              setOpen(false);          
            } else {                  
              setOpen(true);         
            }                       
          }}                       
        > 
        <Cpu className="h-4 w-4 mr-2" />
        Configure Hardware
      </Button>

      {open && (
        <div className="fixed inset-0 z-40 flex items-start justify-end pointer-events-none">
          <div
            ref={panelRef}
            className="pointer-events-auto mt-20 mb-6 mr-6 w-full max-w-xl max-h-[calc(100vh-6rem)] overflow-y-auto rounded-lg bg-white border shadow-lg p-6"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Configure Hardware</h2>
                <p className="text-sm text-muted-foreground">
                  Choose how the system connects and configure addresses &amp;
                  timing.
                </p>
              </div>
              <button
                className="p-1 rounded hover:bg-gray-100"
                onClick={handleCloseWithoutSaving}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tabs at top */}
            <div className="mt-2 border-b flex gap-4 text-sm">
              {showAddressMap && (
                <button
                  type="button"
                  onClick={handleTabChangeToModbus}
                  className={`pb-2 border-b-2 ${
                    activeTab === "modbus"
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-muted-foreground"
                  }`}
                >
                  Modbus Address Map
                </button>
              )}
              <button
                type="button"
                onClick={handleTabChangeToTiming}
                className={`pb-2 border-b-2 ${
                  activeTab === "timing"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-muted-foreground"
                }`}
              >
                Timing Parameters
              </button>
            </div>

            {/* Tab content directly under tabs */}
            <div className="mt-4 space-y-4">
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                If you are unsure which hardware the client uses, keep the system in safe mode:
                `Direct` plus `None / test only`. That keeps the app running without firing any real output.
              </div>
              {hardwareError && (
                <p className="text-xs text-red-500">{hardwareError}</p>
              )}
              {activeTab === "modbus" && (
                <>
                  {/* Mode + high-level config goes below the tabs now */}
                  <div className="mt-6 space-y-6">
                    <div className="space-y-2">
                      <Label
                        htmlFor="mode-select"
                        className="text-sm font-medium"
                      >
                        System Mode
                      </Label>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs text-muted-foreground">
                          Start with safe mode unless the client has confirmed their PLC, Raspberry Pi, or USB relay setup.
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={resetToSafeMode}
                        >
                          Reset To Safe Mode
                        </Button>
                      </div>
                      <select
                        id="mode-select"
                        className="border rounded-md px-3 py-2 text-sm w-full bg-background"
                        value={mode}
                        onChange={(e) => {                     
                          revertUnsavedChanges();             
                          setMode(e.target.value as Mode);   
                        }}                                  
                        >
                        
                        <option value="simulator">
                          Simulator — Python server is brain
                        </option>
                        <option value="openplc">
                          PLC / OpenPLC — external PLC is brain
                        </option>
                        <option value="direct">
                          Direct — no PLC, direct solenoid
                        </option>
                      </select>
                    </div>

                    {mode === "simulator" && (
                      <>
                        <div className="space-y-3">
                          <Label className="text-sm font-medium">
                            Simulator Modbus
                          </Label>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="sm:col-span-2 space-y-1">
                              <Label
                                htmlFor="sim-host"
                                className="text-xs text-muted-foreground"
                              >
                                Simulator Host
                              </Label>
                              <Input
                                id="sim-host"
                                value={simHost}
                                onChange={(e) => setSimHost(e.target.value)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label
                                htmlFor="sim-port"
                                className="text-xs text-muted-foreground"
                              >
                                SimulatorPort
                              </Label>
                              <Input
                                id="sim-port"
                                type="number"
                                min={0}
                                className="h-7 text-xs"
                                value={Number.isNaN(simPort) ? "" : String(simPort)}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  setSimPort((prev) => parseNonNegativeAddress(raw, Number.isNaN(prev) ? 0 : prev));
                                }}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="sm:col-span-2 space-y-1">
                            <Label
                              htmlFor="plc-host"
                              className="text-xs text-muted-foreground"
                            >
                              Physical Host
                            </Label>
                            <Input
                              id="plc-host"
                              value={plcHost}
                              onChange={(e) => setPlcHost(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label
                              htmlFor="plc-port"
                              className="text-xs text-muted-foreground"
                            >
                              Physical Port
                            </Label>
                            <Input
                              id="plc-port"
                              type="number"
                              min={0}
                              className="h-7 text-xs"
                              value={Number.isNaN(plcPort) ? "" : String(plcPort)}
                              onChange={(e) => {
                                const raw = e.target.value;
                                setPlcPort((prev) => parseNonNegativeAddress(raw, Number.isNaN(prev) ? 0 : prev));
                              }}
                            />
                          </div>
                        </div>

                      </>
                    )}

                    {mode === "direct" && (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label
                            htmlFor="backend-select"
                            className="text-sm font-medium"
                          >
                            Solenoid Backend
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Use `None / test only` until the relay wiring and backend machine have been confirmed.
                          </p>
                          <select
                            id="backend-select"
                            className="border rounded-md px-3 py-2 text-sm w-full bg-background"
                            value={solenoidBackend}
                            onChange={(e) =>
                              setSolenoidBackend(
                                e.target.value as SolenoidBackendType,
                              )
                            }
                          >
                            <option value="null">
                              None / test only (no hardware output)
                            </option>
                            <option value="gpio">
                              GPIO — Raspberry Pi or similar
                            </option>
                            <option value="usb">
                              USB relay — HID / serial device
                            </option>
                          </select>
                        </div>

                        {solenoidBackend === "gpio" && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <Label
                                htmlFor="gpio-pin"
                                className="text-xs text-muted-foreground"
                              >
                                GPIO Pin
                              </Label>
                              <Input
                                id="gpio-pin"
                                type="number"
                                value={gpioPin}
                                onChange={(e) =>
                                  setGpioPin(Number(e.target.value) || 0)
                                }
                              />
                            </div>
                            <div className="sm:col-span-2 flex items-center gap-2 mt-5 sm:mt-0">
                              <Switch
                                checked={gpioActiveHigh}
                                onCheckedChange={setGpioActiveHigh}
                              />
                              <span className="text-xs text-muted-foreground">
                                Active high (signal ON = pin HIGH)
                              </span>
                            </div>
                          </div>
                        )}

                        {solenoidBackend === "usb" && (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label
                                  htmlFor="usb-vendor-id"
                                  className="text-xs text-muted-foreground"
                                >
                                  vendor_id
                                </Label>
                                <Input
                                  id="usb-vendor-id"
                                  type="number"
                                  className="h-7 text-xs"
                                  value={usbVendorId}
                                  onChange={(e) =>
                                    setUsbVendorId(Number(e.target.value) || 0)
                                  }
                                />
                              </div>
                        
                              <div className="space-y-1">
                                <Label
                                  htmlFor="usb-product-id"
                                  className="text-xs text-muted-foreground"
                                >
                                  product_id
                                </Label>
                                <Input
                                  id="usb-product-id"
                                  type="number"
                                  className="h-7 text-xs"
                                  value={usbProductId}
                                  onChange={(e) =>
                                    setUsbProductId(Number(e.target.value) || 0)
                                  }
                                />
                              </div>
                            </div>
                        
                            <div className="space-y-1">
                              <Label
                                htmlFor="usb-on-payload"
                                className="text-xs text-muted-foreground"
                              >
                                on_payload (comma-separated bytes)
                              </Label>
                              <Input
                                id="usb-on-payload"
                                className="h-7 text-xs"
                                value={usbOnPayload}
                                onChange={(e) => setUsbOnPayload(e.target.value)}
                              />
                            </div>
                        
                            <div className="space-y-1">
                              <Label
                                htmlFor="usb-off-payload"
                                className="text-xs text-muted-foreground"
                              >
                                off_payload (comma-separated bytes)
                              </Label>
                              <Input
                                id="usb-off-payload"
                                className="h-7 text-xs"
                                value={usbOffPayload}
                                onChange={(e) => setUsbOffPayload(e.target.value)}
                              />
                            </div>
                        
                          </div>
                        )}
                        
                      </div>
                    )}

                    {mode === "openplc" && (
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">
                          PLC Modbus
                        </Label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="sm:col-span-2 space-y-1">
                            <Label
                              htmlFor="plc-host"
                              className="text-xs text-muted-foreground"
                            >
                              Host
                            </Label>
                            <Input
                              id="plc-host"
                              value={plcHost}
                              onChange={(e) => setPlcHost(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label
                              htmlFor="plc-port"
                              className="text-xs text-muted-foreground"
                            >
                              Port
                            </Label>
                            <Input
                              id="plc-port"
                              type="number"
                              min={0}
                              className="h-7 text-xs"
                              value={Number.isNaN(plcPort) ? "" : String(plcPort)}
                              onChange={(e) => {
                                const raw = e.target.value;
                                setPlcPort((prev) => parseNonNegativeAddress(raw, Number.isNaN(prev) ? 0 : prev));
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Modbus map under mode selection */}
                  {showAddressMap && (
                    <div className="space-y-2 border rounded-md p-3 bg-gray-50">
                      {mode === "openplc" && (
                        <div className="mb-2 flex items-start gap-2 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-md p-2">
                          <AlertTriangle className="h-4 w-4 mt-0.5" />
                          <div>
                            <p className="font-semibold">
                              Actual addresses the PLC uses need to be manually changed
                            </p>
                            <p className="pl-4">
                              Updating addresses here does not change
                              actual PLC mapping, but is still needed.
                              Please ensure the coil/register addresses 
                              used here match those manually updated to the file.
                            </p>
                          </div>
                        </div>
                      )}
                      {mode === "simulator" && (
                        <div className="mb-2 flex items-start gap-2 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-md p-2">
                          <AlertTriangle className="h-4 w-4 mt-0.5" />
                          <div>
                            <p className="font-semibold">
                              PLC mode: addresses must also match your PLC
                              program
                            </p>
                            <p>
                             To connect PLC, please ensure that C_SOLENOID address
                             matches a existing coil address in the PLC
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          Modbus Address Map
                        </span>
                        {mapLoading && (
                          <span className="text-xs text-muted-foreground">
                            Loading…
                          </span>
                        )}
                      </div>

                      {mapError && (
                        <p className="text-xs text-red-500">
                          Failed to load map: {mapError}
                        </p>
                      )}

                      {modbusMap && !mapError && (
                        <div className="space-y-3 text-xs">
                          <p className="text-muted-foreground">
                            Buffer length:{" "}
                            <span className="font-mono">
                              {modbusMap.buffer_length}
                            </span>
                          </p>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="font-semibold mb-1">Coils</p>
                              <div className="space-y-1">
                                {Object.entries(modbusMap.coils).map(
                                  ([name, addr]) => (
                                    <div
                                      key={`coil-${name}`}
                                      className="flex items-center gap-2"
                                    >
                                      <span className="font-mono w-28">
                                        {name}
                                      </span>
                                      <Input
                                        type="number"
                                        min={0}
                                        className="h-7 text-xs"
                                        value={
                                          Number.isNaN(addr)
                                            ? ""
                                            : String(addr)
                                        }
                                        onChange={(e) => {
                                          const raw = e.target.value;
                                          setModbusMap((prev) =>
                                            prev
                                              ? {
                                                  ...prev,
                                                  coils: {
                                                    ...prev.coils,
                                                    [name]:
                                                      parseNonNegativeAddress(
                                                        raw,
                                                        prev.coils[name],
                                                      ),
                                                  },
                                                }
                                              : prev,
                                          );
                                        }}
                                      />
                                    </div>
                                  ),
                                )}
                              </div>
                            </div>

                            <div>
                              <p className="font-semibold mb-1">
                                Discrete Inputs
                              </p>
                              <div className="space-y-1">
                                {Object.entries(
                                  modbusMap.discrete_inputs,
                                ).map(([name, addr]) => (
                                  <div
                                    key={`di-${name}`}
                                    className="flex items-center gap-2"
                                  >
                                    <span className="font-mono w-28">
                                      {name}
                                    </span>
                                    <Input
                                      type="number"
                                      min={0}
                                      className="h-7 text-xs"
                                      value={
                                        Number.isNaN(addr)
                                          ? ""
                                          : String(addr)
                                      }
                                      onChange={(e) => {
                                        const raw = e.target.value;
                                        setModbusMap((prev) =>
                                          prev
                                            ? {
                                                ...prev,
                                                discrete_inputs: {
                                                  ...prev.discrete_inputs,
                                                  [name]:
                                                    parseNonNegativeAddress(
                                                      raw,
                                                      prev.discrete_inputs[
                                                        name
                                                      ],
                                                    ),
                                                },
                                              }
                                            : prev,
                                        );
                                      }}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="font-semibold mb-1">
                                Holding Registers (single)
                              </p>
                              <div className="space-y-1">
                                {Object.entries(
                                  modbusMap.holding_registers,
                                ).map(([name, addr]) => (
                                  <div
                                    key={`hr-${name}`}
                                    className="flex items-center gap-2"
                                  >
                                    <span className="font-mono w-28">
                                      {name}
                                    </span>
                                    <Input
                                      type="number"
                                      min={0}
                                      className="h-7 text-xs"
                                      value={
                                        Number.isNaN(addr)
                                          ? ""
                                          : String(addr)
                                      }
                                      onChange={(e) => {
                                        const raw = e.target.value;
                                        setModbusMap((prev) =>
                                          prev
                                            ? {
                                                ...prev,
                                                holding_registers: {
                                                  ...prev.holding_registers,
                                                  [name]:
                                                    parseNonNegativeAddress(
                                                      raw,
                                                      prev
                                                        .holding_registers[name],
                                                    ),
                                                },
                                              }
                                            : prev,
                                        );
                                      }}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div>
                              <p className="font-semibold mb-1">
                                Holding Registers (arrays)
                              </p>
                              <div className="space-y-1">
                                {modbusMap.holding_registers_many.map(
                                  (block, idx) => {
                                    const endAddr =
                                      block.length > 1
                                        ? block.address + block.length - 1
                                        : block.address;
                                    return (
                                      <div
                                        key={`hrmany-${block.name}-${idx}`}
                                        className="flex items-center gap-2"
                                      >
                                        <span className="font-mono w-28">
                                          {block.name}
                                        </span>
                                        <Input
                                          type="number"
                                          min={0}
                                          className="h-7 text-xs"
                                          value={
                                            Number.isNaN(block.address)
                                              ? ""
                                              : String(block.address)
                                          }
                                          onChange={(e) => {
                                            const raw = e.target.value;
                                            setModbusMap((prev) =>
                                              prev
                                                ? {
                                                    ...prev,
                                                    holding_registers_many:
                                                      prev.holding_registers_many.map(
                                                        (b, i) =>
                                                          i === idx
                                                            ? {
                                                                ...b,
                                                                address:
                                                                  parseNonNegativeAddress(
                                                                    raw,
                                                                    b.address,
                                                                  ),
                                                              }
                                                            : b,
                                                      ),
                                                  }
                                                : prev,
                                            );
                                          }}
                                        />
                                        <span className="text-[10px] text-muted-foreground">
                                          {block.length > 1 &&
                                          !Number.isNaN(block.address)
                                            ? `→ ${endAddr}`
                                            : ""}
                                        </span>
                                      </div>
                                    );
                                  },
                                )}
                              </div>
                            </div>
                          </div>

                          {saveError && (
                            <p className="text-xs text-red-500 mt-1">
                              {saveError}
                            </p>
                          )}
                          {saveSuccess && (
                            <p className="text-xs text-green-600 mt-1">
                              Modbus map saved.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {activeTab === "timing" && (
                <div className="space-y-3 border rounded-md p-3 bg-gray-50 text-xs">
                <div className="mb-2 flex items-start gap-2 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-md p-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5" />
                  <div>
                    <p className="font-semibold">
                      If PLC/OpenPLC method is used, actual timing values the PLC uses need to be manually changed
                    </p>
                    <p className="pl-4">
                      Updating timing here does not change
                      actual PLC mapping, but is still needed.
                      Please ensure that the timing parameters 
                      used here match those manually updated to the file.
                    </p>
                  </div>
                </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      Timing Parameters
                    </span>
                    {timingLoading && (
                      <span className="text-xs text-muted-foreground">
                        Loading…
                      </span>
                    )}
                  </div>

                  {timingError && (
                    <p className="text-xs text-red-500">
                      Failed to load timing config: {timingError}
                    </p>
                  )}

                  {timingConfig && !timingError && (
                    <>
                      <p className="text-muted-foreground mb-1">
                        These values control latency, travel distance, and pulse
                        widths used by the solenoid controller.
                      </p>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Latency (ms)</Label>
                          <Input
                            type="number"
                            className="h-7 text-xs"
                            value={timingConfig.latency_ms}
                            onChange={(e) =>
                              setTimingConfig((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      latency_ms: Number(e.target.value) || 0,
                                    }
                                  : prev,
                              )
                            }
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Distance (mm)</Label>
                          <Input
                            type="number"
                            className="h-7 text-xs"
                            value={timingConfig.distance_mm}
                            onChange={(e) =>
                              setTimingConfig((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      distance_mm: Number(e.target.value) || 0,
                                    }
                                  : prev,
                              )
                            }
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">
                            Conveyor speed (mm/s)
                          </Label>
                          <Input
                            type="number"
                            className="h-7 text-xs"
                            value={timingConfig.conveyor_speed_mm_per_s}
                            onChange={(e) =>
                              setTimingConfig((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      conveyor_speed_mm_per_s:
                                        Number(e.target.value) || 0,
                                    }
                                  : prev,
                              )
                            }
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Margin (ms)</Label>
                          <Input
                            type="number"
                            className="h-7 text-xs"
                            value={timingConfig.margin_ms}
                            onChange={(e) =>
                              setTimingConfig((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      margin_ms: Number(e.target.value) || 0,
                                    }
                                  : prev,
                              )
                            }
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Min pulse (ms)</Label>
                          <Input
                            type="number"
                            className="h-7 text-xs"
                            value={timingConfig.min_pulse_ms}
                            onChange={(e) =>
                              setTimingConfig((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      min_pulse_ms: Number(e.target.value) || 0,
                                    }
                                  : prev,
                              )
                            }
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Merge gap (ms)</Label>
                          <Input
                            type="number"
                            className="h-7 text-xs"
                            value={timingConfig.merge_gap_ms}
                            onChange={(e) =>
                              setTimingConfig((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      merge_gap_ms: Number(e.target.value) || 0,
                                    }
                                  : prev,
                              )
                            }
                          />
                        </div>
                      </div>

                      {timingError && (
                        <p className="text-xs text-red-500 mt-1">
                          {timingError}
                        </p>
                      )}
                      {timingSaveSuccess && (
                        <p className="text-xs text-green-600 mt-1">
                          Timing configuration saved.
                        </p>
                      )}
                      {savingTiming && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Saving timing…
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Buttons */}
            <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={handleCloseWithoutSaving}>
                Cancel
              </Button>
              <Button variant="outline" onClick={handleSaveAll} disabled={savingMap || savingTiming || savingHardware}>
                {savingMap || savingTiming || savingHardware ? "Saving..." : "Save Configuration"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
