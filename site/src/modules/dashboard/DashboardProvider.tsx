import {
  createContext,
  type FC,
  type PropsWithChildren,
  useCallback,
  useState,
} from "react";
import { useQuery } from "react-query";
import { appearance } from "api/queries/appearance";
import { entitlements } from "api/queries/entitlements";
import { experiments } from "api/queries/experiments";
import type {
  AppearanceConfig,
  Entitlements,
  Experiments,
} from "api/typesGenerated";
import { displayError } from "components/GlobalSnackbar/utils";
import { Loader } from "components/Loader/Loader";
import { useEmbeddedMetadata } from "hooks/useEmbeddedMetadata";
import { hslToHex, isHexColor, isHslColor } from "utils/colors";

interface Appearance {
  config: AppearanceConfig;
  isPreview: boolean;
  setPreview: (config: AppearanceConfig) => void;
}

export interface DashboardValue {
  entitlements: Entitlements;
  experiments: Experiments;
  appearance: Appearance;
}

export const DashboardContext = createContext<DashboardValue | undefined>(
  undefined,
);

export const DashboardProvider: FC<PropsWithChildren> = ({ children }) => {
  const { metadata } = useEmbeddedMetadata();
  const entitlementsQuery = useQuery(entitlements(metadata.entitlements));
  const experimentsQuery = useQuery(experiments(metadata.experiments));
  const appearanceQuery = useQuery(appearance(metadata.appearance));

  const isLoading =
    !entitlementsQuery.data || !appearanceQuery.data || !experimentsQuery.data;

  const [configPreview, setConfigPreview] = useState<AppearanceConfig>();

  // Centralizing the logic for catching malformed configs in one spot, just to
  // be on the safe side; don't want to expose raw setConfigPreview outside
  // the provider
  const setPreview = useCallback((newConfig: AppearanceConfig) => {
    // Have runtime safety nets in place, just because so much of the codebase
    // relies on HSL for formatting, but server expects hex values. Can't catch
    // color format mismatches at the type level
    const incomingBg = newConfig.service_banner.background_color;
    let configForDispatch = newConfig;

    if (typeof incomingBg === "string" && isHslColor(incomingBg)) {
      configForDispatch = {
        ...newConfig,
        service_banner: {
          ...newConfig.service_banner,
          background_color: hslToHex(incomingBg),
        },
      };
    } else if (typeof incomingBg === "string" && !isHexColor(incomingBg)) {
      displayError(`The value ${incomingBg} is not a valid hex string`);
      return;
    }

    setConfigPreview(configForDispatch);
  }, []);

  if (isLoading) {
    return <Loader fullscreen />;
  }

  return (
    <DashboardContext.Provider
      value={{
        entitlements: entitlementsQuery.data,
        experiments: experimentsQuery.data,
        appearance: {
          config: configPreview ?? appearanceQuery.data,
          setPreview: setPreview,
          isPreview: configPreview !== undefined,
        },
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
};
