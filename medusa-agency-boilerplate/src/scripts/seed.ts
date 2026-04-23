import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import {
  createApiKeysWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkProductsToSalesChannelWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateProductsWorkflow,
  updateRegionsWorkflow,
  updateStoresStep,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows";
import { ApiKey } from "../../.medusa/types/query-entry-points";
import { bootstrapApiShipSettings, getDefaultApiShipSettings } from "../modules/apiship-settings";
import { ensureApiShipShippingOptionsForStore } from "../modules/apiship-store";

type RegionRecord = {
  id: string;
  name?: string | null;
  currency_code?: string | null;
  countries?: { iso_2?: string | null }[] | null;
  payment_providers?: { id?: string | null }[] | null;
};

type TaxRegionRecord = {
  id: string;
  country_code?: string | null;
};

type StockLocationRecord = {
  id: string;
  name?: string | null;
};

type FulfillmentSetRecord = {
  id: string;
  name?: string | null;
  service_zones?: { id: string }[] | null;
};

type ShippingOptionRecord = {
  id: string;
  name?: string | null;
  provider_id?: string | null;
  data?: Record<string, unknown> | null;
};

type ShippingProfileRecord = {
  id: string;
  name?: string | null;
  type?: string | null;
};

type ProductRecord = {
  id: string;
  handle?: string | null;
  title?: string | null;
  thumbnail?: string | null;
  options?: { id: string; title?: string | null }[] | null;
  variants?: { id: string; title?: string | null; sku?: string | null }[] | null;
  images?: { id: string; url?: string | null }[] | null;
};

type CatalogSeedDefinition = {
  handle: string;
  title: string;
  subtitle: string;
  description: string;
  thumbnail: string;
  images: string[];
  options: {
    title: string;
    values: string[];
  }[];
  variants: {
    title: string;
    sku: string;
    prices: {
      amount: number;
      currency_code: string;
    }[];
    options: Record<string, string>;
  }[];
  metadata: Record<string, string>;
};

const DEFAULT_COUNTRY_CODE = "ru";
const DEFAULT_REGION_NAME = "Russia";
const DEFAULT_CURRENCY_CODE = "rub";
const DEFAULT_SALES_CHANNEL_NAME = "Default Sales Channel";
const DEFAULT_STOCK_LOCATION_NAME = "Template RU Warehouse";
const DEFAULT_FULFILLMENT_SET_NAME = "Template RU Fulfillment";
const DEFAULT_SHIPPING_PROFILE_NAME = "Default Shipping Profile";
const DEFAULT_SHIPPING_OPTION_NAME = "Template Standard Shipping";
const APISHIP_SHIPPING_OPTION_NAME = "ApiShip Courier to Address";
const DEFAULT_PUBLISHABLE_KEY_TITLE = "Webshop";
const DEFAULT_PAYMENT_PROVIDER_ID = "pp_system_default";
const YOOKASSA_PAYMENT_PROVIDER_ID = "pp_yookassa_yookassa";
const MANUAL_FULFILLMENT_PROVIDER_ID = "manual_manual";
const APISHIP_FULFILLMENT_PROVIDER_ID = "apiship_apiship";
const BASELINE_HARDENING_HINT =
  "Resolve the conflicting baseline entities on this database or rerun bootstrap on a clean clone.";
const SHOPPER_FACING_CATALOG: CatalogSeedDefinition[] = [
  {
    handle: "linen-overshirt-sand",
    title: "Льняная оверсайз-рубашка Sand",
    subtitle: "Лёгкая базовая рубашка для межсезонья",
    description:
      "Мягкая рубашка из смесового льна с расслабленной посадкой, плотными пуговицами и аккуратной отделкой воротника. Подходит для ежедневной витрины, тестов карточки товара и сценариев с несколькими размерно-цветовыми вариантами.",
    thumbnail:
      "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1200&q=80",
    images: [
      "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80",
    ],
    options: [
      {
        title: "Размер",
        values: ["S", "M", "L"],
      },
      {
        title: "Цвет",
        values: ["Песочный", "Небесно-голубой"],
      },
    ],
    variants: [
      {
        title: "S / Песочный",
        sku: "LINEN-OVERSHIRT-SAND-S",
        prices: [{ amount: 8900, currency_code: DEFAULT_CURRENCY_CODE }],
        options: {
          Размер: "S",
          Цвет: "Песочный",
        },
      },
      {
        title: "M / Песочный",
        sku: "LINEN-OVERSHIRT-SAND-M",
        prices: [{ amount: 8900, currency_code: DEFAULT_CURRENCY_CODE }],
        options: {
          Размер: "M",
          Цвет: "Песочный",
        },
      },
      {
        title: "L / Песочный",
        sku: "LINEN-OVERSHIRT-SAND-L",
        prices: [{ amount: 8900, currency_code: DEFAULT_CURRENCY_CODE }],
        options: {
          Размер: "L",
          Цвет: "Песочный",
        },
      },
      {
        title: "M / Небесно-голубой",
        sku: "LINEN-OVERSHIRT-BLUE-M",
        prices: [{ amount: 9300, currency_code: DEFAULT_CURRENCY_CODE }],
        options: {
          Размер: "M",
          Цвет: "Небесно-голубой",
        },
      },
    ],
    metadata: {
      seed_collection: "manual-test-catalog",
      merchandising_theme: "resort-essentials",
    },
  },
  {
    handle: "commuter-leather-backpack",
    title: "Кожаный рюкзак Commuter",
    subtitle: "Городской рюкзак для ноутбука и поездок",
    description:
      "Компактный рюкзак из плотной кожи с отделением под ноутбук 14\" и внешним карманом быстрого доступа. Нужен для ручных тестов checkout и admin с вариантом по цвету и объёму.",
    thumbnail:
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1200&q=80",
    images: [
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1200&q=80",
    ],
    options: [
      {
        title: "Цвет",
        values: ["Чёрный", "Коньячный"],
      },
      {
        title: "Объём",
        values: ["14L", "18L"],
      },
    ],
    variants: [
      {
        title: "Чёрный / 14L",
        sku: "COMMUTER-BACKPACK-BLK-14",
        prices: [{ amount: 16900, currency_code: DEFAULT_CURRENCY_CODE }],
        options: {
          Цвет: "Чёрный",
          Объём: "14L",
        },
      },
      {
        title: "Чёрный / 18L",
        sku: "COMMUTER-BACKPACK-BLK-18",
        prices: [{ amount: 17900, currency_code: DEFAULT_CURRENCY_CODE }],
        options: {
          Цвет: "Чёрный",
          Объём: "18L",
        },
      },
      {
        title: "Коньячный / 14L",
        sku: "COMMUTER-BACKPACK-TAN-14",
        prices: [{ amount: 16900, currency_code: DEFAULT_CURRENCY_CODE }],
        options: {
          Цвет: "Коньячный",
          Объём: "14L",
        },
      },
      {
        title: "Коньячный / 18L",
        sku: "COMMUTER-BACKPACK-TAN-18",
        prices: [{ amount: 17900, currency_code: DEFAULT_CURRENCY_CODE }],
        options: {
          Цвет: "Коньячный",
          Объём: "18L",
        },
      },
    ],
    metadata: {
      seed_collection: "manual-test-catalog",
      merchandising_theme: "city-carry",
    },
  },
  {
    handle: "stoneware-brew-mug",
    title: "Керамическая кружка Stoneware Brew",
    subtitle: "Фактурная кружка для кофе и чая",
    description:
      "Кружка ручной фактуры с матовой глазурью и удобной широкой ручкой. Подходит для тестирования недорогих товаров, медиа-галереи и компактных вариантных матриц.",
    thumbnail:
      "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=1200&q=80",
    images: [
      "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1200&q=80",
    ],
    options: [
      {
        title: "Цвет",
        values: ["Молочный", "Графит"],
      },
      {
        title: "Объём",
        values: ["300 мл", "450 мл"],
      },
    ],
    variants: [
      {
        title: "Молочный / 300 мл",
        sku: "STONEWARE-MUG-CRM-300",
        prices: [{ amount: 2900, currency_code: DEFAULT_CURRENCY_CODE }],
        options: {
          Цвет: "Молочный",
          Объём: "300 мл",
        },
      },
      {
        title: "Молочный / 450 мл",
        sku: "STONEWARE-MUG-CRM-450",
        prices: [{ amount: 3300, currency_code: DEFAULT_CURRENCY_CODE }],
        options: {
          Цвет: "Молочный",
          Объём: "450 мл",
        },
      },
      {
        title: "Графит / 300 мл",
        sku: "STONEWARE-MUG-GPH-300",
        prices: [{ amount: 2900, currency_code: DEFAULT_CURRENCY_CODE }],
        options: {
          Цвет: "Графит",
          Объём: "300 мл",
        },
      },
      {
        title: "Графит / 450 мл",
        sku: "STONEWARE-MUG-GPH-450",
        prices: [{ amount: 3300, currency_code: DEFAULT_CURRENCY_CODE }],
        options: {
          Цвет: "Графит",
          Объём: "450 мл",
        },
      },
    ],
    metadata: {
      seed_collection: "manual-test-catalog",
      merchandising_theme: "home-brew",
    },
  },
];

const updateStoreCurrencies = createWorkflow(
  "update-store-currencies",
  (input: {
    supported_currencies: { currency_code: string; is_default?: boolean }[];
    store_id: string;
  }) => {
    const normalizedInput = transform({ input }, (data) => {
      return {
        selector: { id: data.input.store_id },
        update: {
          supported_currencies: data.input.supported_currencies.map((currency) => {
            return {
              currency_code: currency.currency_code,
              is_default: currency.is_default ?? false,
            };
          }),
        },
      };
    });

    const stores = updateStoresStep(normalizedInput);

    return new WorkflowResponse(stores);
  }
);

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

const isExistingLinkError = (error: unknown) => {
  const message = getErrorMessage(error);

  return /(already exists|already linked|duplicate|unique constraint)/i.test(
    message
  );
};

const ensureUniqueMatch = <T>(matches: T[], description: string) => {
  if (matches.length > 1) {
    throw new Error(
      `Bootstrap found multiple ${description}. ${BASELINE_HARDENING_HINT}`
    );
  }

  return matches[0] ?? null;
};

const countryMatches = (countryCode?: string | null) =>
  countryCode?.toLowerCase() === DEFAULT_COUNTRY_CODE;

const regionMatchesBaseline = (candidate: RegionRecord) => {
  return (
    candidate.countries?.some((country) => countryMatches(country.iso_2)) ||
    candidate.name === DEFAULT_REGION_NAME
  );
};

const findReusableShippingOption = (
  existingShippingOptions: ShippingOptionRecord[],
  name: string,
  expectedProviderId: string
) => {
  const nameMatches = existingShippingOptions.filter(
    (candidate) => candidate.name === name
  );

  const reusableOption = ensureUniqueMatch(
    nameMatches,
    `shipping options named "${name}"`
  );

  if (!reusableOption) {
    return null;
  }

  if (reusableOption.provider_id !== expectedProviderId) {
    throw new Error(
      `Bootstrap found shipping option "${name}" bound to provider "${reusableOption.provider_id ?? "unknown"}" instead of "${expectedProviderId}". ${BASELINE_HARDENING_HINT}`
    );
  }

  return reusableOption;
};

const toUniqueImageRecords = (thumbnail: string, images: string[]) => {
  const ordered = [thumbnail, ...images];
  const seen = new Set<string>();

  return ordered
    .filter((url) => {
      if (!url || seen.has(url)) {
        return false;
      }

      seen.add(url);
      return true;
    })
    .map((url) => ({ url }));
};

const buildCreateCatalogProductInput = ({
  product,
  shippingProfileId,
  salesChannelId,
}: {
  product: CatalogSeedDefinition;
  shippingProfileId: string;
  salesChannelId: string;
}) => {
  return {
    title: product.title,
    subtitle: product.subtitle,
    handle: product.handle,
    description: product.description,
    status: "published" as const,
    is_giftcard: false,
    discountable: true,
    shipping_profile_id: shippingProfileId,
    sales_channels: [{ id: salesChannelId }],
    thumbnail: product.thumbnail,
    images: toUniqueImageRecords(product.thumbnail, product.images),
    options: product.options,
    variants: product.variants.map((variant) => ({
      title: variant.title,
      sku: variant.sku,
      manage_inventory: false,
      allow_backorder: false,
      options: variant.options,
      prices: variant.prices,
    })),
    metadata: product.metadata,
  };
};

const buildUpdateCatalogProductInput = ({
  existingProduct,
  product,
  shippingProfileId,
}: {
  existingProduct: ProductRecord;
  product: CatalogSeedDefinition;
  shippingProfileId: string;
}) => {
  const optionIdByTitle = new Map<string, string>(
    ((existingProduct.options ?? [])
      .filter((option): option is { id: string; title: string } => !!option.id && !!option.title)
      .map((option) => [option.title, option.id]) as [string, string][])
  );
  const variantIdBySku = new Map<string, string>(
    ((existingProduct.variants ?? [])
      .filter((variant): variant is { id: string; sku: string } => !!variant.id && !!variant.sku)
      .map((variant) => [variant.sku, variant.id]) as [string, string][])
  );
  const imageIdByUrl = new Map<string, string>(
    ((existingProduct.images ?? [])
      .filter((image): image is { id: string; url: string } => !!image.id && !!image.url)
      .map((image) => [image.url, image.id]) as [string, string][])
  );

  return {
    id: existingProduct.id,
    title: product.title,
    subtitle: product.subtitle,
    handle: product.handle,
    description: product.description,
    status: "published" as const,
    is_giftcard: false,
    discountable: true,
    shipping_profile_id: shippingProfileId,
    thumbnail: product.thumbnail,
    images: toUniqueImageRecords(product.thumbnail, product.images).map((image) => ({
      id: imageIdByUrl.get(image.url),
      url: image.url,
    })),
    options: product.options.map((option) => ({
      id: optionIdByTitle.get(option.title),
      title: option.title,
      values: option.values,
    })),
    variants: product.variants.map((variant) => ({
      id: variantIdBySku.get(variant.sku),
      title: variant.title,
      sku: variant.sku,
      manage_inventory: false,
      allow_backorder: false,
      options: variant.options,
      prices: variant.prices,
    })),
    metadata: product.metadata,
  };
};

export default async function seedDemoData({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const pgConnection = container.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL);
  const storeModuleService = container.resolve(Modules.STORE);

  const ensureDirectLink = async (
    description: string,
    input: Record<string, Record<string, string>>
  ) => {
    try {
      await link.create(input);
    } catch (error) {
      if (isExistingLinkError(error)) {
        logger.info(`Reusing existing ${description} link.`);
        return;
      }

      throw new Error(
        `Bootstrap failed while ensuring ${description} link: ${getErrorMessage(error)}`
      );
    }
  };

  const ensureWorkflowLink = async (
    description: string,
    callback: () => Promise<unknown>
  ) => {
    try {
      await callback();
    } catch (error) {
      if (isExistingLinkError(error)) {
        logger.info(`Reusing existing ${description} link.`);
        return;
      }

      throw new Error(
        `Bootstrap failed while ensuring ${description} link: ${getErrorMessage(error)}`
      );
    }
  };

  logger.info("Seeding template-ready store data...");
  const [store] = await storeModuleService.listStores();

  if (!store) {
    throw new Error("No Medusa store found to bootstrap.");
  }

  const defaultSalesChannels = await salesChannelModuleService.listSalesChannels({
    name: DEFAULT_SALES_CHANNEL_NAME,
  });

  let defaultSalesChannel = ensureUniqueMatch(
    defaultSalesChannels,
    `sales channels named "${DEFAULT_SALES_CHANNEL_NAME}"`
  );

  if (!defaultSalesChannel) {
    const { result: salesChannelResult } = await createSalesChannelsWorkflow(
      container
    ).run({
      input: {
        salesChannelsData: [
          {
            name: DEFAULT_SALES_CHANNEL_NAME,
          },
        ],
      },
    });

    defaultSalesChannel = salesChannelResult[0];
    logger.info(`Created sales channel "${DEFAULT_SALES_CHANNEL_NAME}".`);
  } else {
    logger.info(`Reusing sales channel "${DEFAULT_SALES_CHANNEL_NAME}".`);
  }

  await updateStoreCurrencies(container).run({
    input: {
      store_id: store.id,
      supported_currencies: [
        {
          currency_code: DEFAULT_CURRENCY_CODE,
          is_default: true,
        },
      ],
    },
  });

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        default_sales_channel_id: defaultSalesChannel.id,
      },
    },
  });
  logger.info("Finished seeding store data.");

  logger.info("Seeding region data...");
  const { data: existingRegions } = await query.graph({
    entity: "region",
    fields: [
      "id",
      "name",
      "currency_code",
      "countries.iso_2",
      "payment_providers.id",
    ],
  });

  let region = ensureUniqueMatch(
    ((existingRegions as RegionRecord[] | undefined) ?? []).filter(
      regionMatchesBaseline
    ),
    `regions matching country "${DEFAULT_COUNTRY_CODE}" or name "${DEFAULT_REGION_NAME}"`
  );

  if (!region) {
    const { result: regionResult } = await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: DEFAULT_REGION_NAME,
            currency_code: DEFAULT_CURRENCY_CODE,
            countries: [DEFAULT_COUNTRY_CODE],
            payment_providers: [DEFAULT_PAYMENT_PROVIDER_ID],
          },
        ],
      },
    });

    region = regionResult[0] as RegionRecord;
    logger.info(`Created region "${DEFAULT_REGION_NAME}".`);
  } else {
    logger.info(`Reusing region "${region.name ?? DEFAULT_REGION_NAME}".`);
  }

  const regionPaymentProviders = new Set<string>(
    ((region.payment_providers ?? []).map((provider) => provider.id).filter(Boolean) ?? []) as string[]
  );
  regionPaymentProviders.add(DEFAULT_PAYMENT_PROVIDER_ID);

  if (
    process.env.YOOKASSA_SHOP_ID?.trim() &&
    process.env.YOOKASSA_SECRET_KEY?.trim() &&
    process.env.YOOKASSA_RETURN_URL?.trim()
  ) {
    regionPaymentProviders.add(YOOKASSA_PAYMENT_PROVIDER_ID);
  }

  await updateRegionsWorkflow(container).run({
    input: {
      selector: { id: region.id },
      update: {
        payment_providers: Array.from(regionPaymentProviders),
      },
    },
  });
  logger.info("Finished seeding regions.");

  logger.info("Seeding tax regions...");
  const { data: existingTaxRegions } = await query.graph({
    entity: "tax_region",
    fields: ["id", "country_code"],
  });

  const matchingTaxRegions = ((existingTaxRegions as TaxRegionRecord[] | undefined) ?? []).filter(
    (candidate) => countryMatches(candidate.country_code)
  );

  const taxRegion = ensureUniqueMatch(
    matchingTaxRegions,
    `tax regions for country "${DEFAULT_COUNTRY_CODE}"`
  );

  if (!taxRegion) {
    await createTaxRegionsWorkflow(container).run({
      input: [
        {
          country_code: DEFAULT_COUNTRY_CODE,
          provider_id: "tp_system",
        },
      ],
    });
    logger.info(`Created tax region for country "${DEFAULT_COUNTRY_CODE}".`);
  } else {
    logger.info(`Reusing tax region for country "${DEFAULT_COUNTRY_CODE}".`);
  }
  logger.info("Finished seeding tax regions.");

  logger.info("Seeding stock location data...");
  const { data: existingStockLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
  });

  let stockLocation = ensureUniqueMatch(
    ((existingStockLocations as StockLocationRecord[] | undefined) ?? []).filter(
      (candidate) => candidate.name === DEFAULT_STOCK_LOCATION_NAME
    ),
    `stock locations named "${DEFAULT_STOCK_LOCATION_NAME}"`
  );

  if (!stockLocation) {
    const { result: stockLocationResult } = await createStockLocationsWorkflow(
      container
    ).run({
      input: {
        locations: [
          {
            name: DEFAULT_STOCK_LOCATION_NAME,
            address: {
              city: "Moscow",
              country_code: DEFAULT_COUNTRY_CODE.toUpperCase(),
              address_1: "Складская ул., д. 1",
              postal_code: "101000",
            },
          },
        ],
      },
    });

    stockLocation = stockLocationResult[0] as StockLocationRecord;
    logger.info(`Created stock location "${DEFAULT_STOCK_LOCATION_NAME}".`);
  } else {
    logger.info(`Reusing stock location "${DEFAULT_STOCK_LOCATION_NAME}".`);
  }

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        default_location_id: stockLocation.id,
      },
    },
  });

  await ensureDirectLink("stock location to manual fulfillment provider", {
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_provider_id: MANUAL_FULFILLMENT_PROVIDER_ID,
    },
  });

  if (process.env.APISHIP_TOKEN?.trim()) {
    await ensureDirectLink("stock location to ApiShip fulfillment provider", {
      [Modules.STOCK_LOCATION]: {
        stock_location_id: stockLocation.id,
      },
      [Modules.FULFILLMENT]: {
        fulfillment_provider_id: APISHIP_FULFILLMENT_PROVIDER_ID,
      },
    });
  }

  logger.info("Seeding fulfillment data...");
  const shippingProfiles = (await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  })) as ShippingProfileRecord[];

  const namedShippingProfiles = shippingProfiles.filter(
    (candidate) => candidate.name === DEFAULT_SHIPPING_PROFILE_NAME
  );

  let shippingProfile = ensureUniqueMatch(
    namedShippingProfiles,
    `shipping profiles named "${DEFAULT_SHIPPING_PROFILE_NAME}"`
  );

  if (!shippingProfile) {
    if (shippingProfiles.length === 1) {
      shippingProfile = shippingProfiles[0];
      logger.info(
        `Reusing existing default shipping profile "${shippingProfile.name ?? shippingProfile.id}".`
      );
    } else if (shippingProfiles.length === 0) {
      const { result: shippingProfileResult } =
        await createShippingProfilesWorkflow(container).run({
          input: {
            data: [
              {
                name: DEFAULT_SHIPPING_PROFILE_NAME,
                type: "default",
              },
            ],
          },
        });

      shippingProfile = shippingProfileResult[0] as ShippingProfileRecord;
      logger.info(`Created shipping profile "${DEFAULT_SHIPPING_PROFILE_NAME}".`);
    } else {
      throw new Error(
        `Bootstrap found multiple default shipping profiles without a baseline match. ${BASELINE_HARDENING_HINT}`
      );
    }
  } else {
    logger.info(`Reusing shipping profile "${shippingProfile.name}".`);
  }

  const { data: existingFulfillmentSets } = await query.graph({
    entity: "fulfillment_set",
    fields: ["id", "name", "service_zones.id"],
  });

  let fulfillmentSet = ensureUniqueMatch(
    ((existingFulfillmentSets as FulfillmentSetRecord[] | undefined) ?? []).filter(
      (candidate) => candidate.name === DEFAULT_FULFILLMENT_SET_NAME
    ),
    `fulfillment sets named "${DEFAULT_FULFILLMENT_SET_NAME}"`
  );

  if (!fulfillmentSet) {
    fulfillmentSet = (await fulfillmentModuleService.createFulfillmentSets({
      name: DEFAULT_FULFILLMENT_SET_NAME,
      type: "shipping",
      service_zones: [
        {
          name: DEFAULT_REGION_NAME,
          geo_zones: [
            {
              country_code: DEFAULT_COUNTRY_CODE,
              type: "country",
            },
          ],
        },
      ],
    })) as FulfillmentSetRecord;
    logger.info(`Created fulfillment set "${DEFAULT_FULFILLMENT_SET_NAME}".`);
  } else {
    logger.info(`Reusing fulfillment set "${DEFAULT_FULFILLMENT_SET_NAME}".`);
  }

  await ensureDirectLink("stock location to fulfillment set", {
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_set_id: fulfillmentSet.id,
    },
  });

  const serviceZoneId = fulfillmentSet.service_zones?.[0]?.id;

  if (!serviceZoneId) {
    throw new Error(
      `Template fulfillment set "${DEFAULT_FULFILLMENT_SET_NAME}" is missing a service zone. ${BASELINE_HARDENING_HINT}`
    );
  }

  const { data: existingShippingOptions } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "name", "provider_id", "data"],
  });

  const shippingOptions =
    (existingShippingOptions as ShippingOptionRecord[] | undefined) ?? [];
  const reusableDefaultShippingOption = findReusableShippingOption(
    shippingOptions,
    DEFAULT_SHIPPING_OPTION_NAME,
    MANUAL_FULFILLMENT_PROVIDER_ID
  );
  const reusableApiShipShippingOption = findReusableShippingOption(
    shippingOptions,
    APISHIP_SHIPPING_OPTION_NAME,
    APISHIP_FULFILLMENT_PROVIDER_ID
  );

  const shippingOptionsToCreate: any[] = [];
  const defaultApiShipSettings = getDefaultApiShipSettings({
    enabled: !!process.env.APISHIP_TOKEN?.trim(),
  });

  if (!reusableDefaultShippingOption) {
    shippingOptionsToCreate.push({
      name: DEFAULT_SHIPPING_OPTION_NAME,
      price_type: "flat",
      provider_id: MANUAL_FULFILLMENT_PROVIDER_ID,
      service_zone_id: serviceZoneId,
      shipping_profile_id: shippingProfile.id,
      type: {
        label: "Default",
        description: "Template-ready shipping option.",
        code: "default",
      },
      prices: [
        {
          region_id: region.id,
          amount: 0,
        },
      ],
      rules: [
        {
          attribute: "enabled_in_store",
          value: "true",
          operator: "eq" as const,
        },
        {
          attribute: "is_return",
          value: "false",
          operator: "eq" as const,
        },
      ],
    });
  } else {
    logger.info(`Reusing shipping option "${DEFAULT_SHIPPING_OPTION_NAME}".`);
  }

  if (process.env.APISHIP_TOKEN?.trim()) {
    if (!reusableApiShipShippingOption) {
      shippingOptionsToCreate.push({
        name: APISHIP_SHIPPING_OPTION_NAME,
        price_type: "calculated",
        provider_id: APISHIP_FULFILLMENT_PROVIDER_ID,
        service_zone_id: serviceZoneId,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Courier",
          description:
            "Legacy ApiShip courier shipping option kept for backward-compatible upgrade paths.",
          code: "apiship-courier-legacy",
        },
        data: {
          id: "apiship_courier_to_address",
          deliveryType: 1,
          pickupType: 1,
        },
        rules: [
          {
            attribute: "enabled_in_store",
            value: "false",
            operator: "eq" as const,
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq" as const,
          },
        ],
      });
    } else {
      logger.info(`Reusing shipping option "${APISHIP_SHIPPING_OPTION_NAME}".`);
    }
  }

  if (shippingOptionsToCreate.length) {
    await createShippingOptionsWorkflow(container).run({
      input: shippingOptionsToCreate,
    });
    logger.info(`Created ${shippingOptionsToCreate.length} missing shipping option(s).`);
  }

  if (process.env.APISHIP_TOKEN?.trim()) {
    await bootstrapApiShipSettings(pgConnection, {
      enabled: defaultApiShipSettings.enabled,
      modes: defaultApiShipSettings.modes,
    });

    const refreshedShippingOptions = (
      (
        await query.graph({
          entity: "shipping_option",
          fields: ["id", "name", "provider_id", "data"],
          filters: {
            provider_id: APISHIP_FULFILLMENT_PROVIDER_ID,
          },
        })
      ).data as ShippingOptionRecord[] | undefined
    ) ?? [];

    await ensureApiShipShippingOptionsForStore({
      container,
      service_zone_id: serviceZoneId,
      shipping_profile_id: shippingProfile.id,
      existing_shipping_options: refreshedShippingOptions,
      settings: defaultApiShipSettings,
    });
  }

  await ensureWorkflowLink("sales channel to stock location", async () => {
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: {
        id: stockLocation.id,
        add: [defaultSalesChannel.id],
      },
    });
  });
  logger.info("Finished seeding fulfillment data.");
  logger.info("Finished seeding stock location data.");

  logger.info("Seeding shopper-facing catalog data...");
  const catalogHandles = new Set(SHOPPER_FACING_CATALOG.map((product) => product.handle));
  const catalogProductFields = [
    "id",
    "handle",
    "title",
    "thumbnail",
    "options.id",
    "options.title",
    "variants.id",
    "variants.title",
    "variants.sku",
    "images.id",
    "images.url",
  ];
  const { data: existingProductsData } = await query.graph({
    entity: "product",
    fields: catalogProductFields,
  });

  const existingCatalogProducts =
    ((existingProductsData as ProductRecord[] | undefined) ?? []).filter((product) =>
      catalogHandles.has(product.handle ?? "")
    );

  for (const catalogProduct of SHOPPER_FACING_CATALOG) {
    const existingProduct = ensureUniqueMatch(
      existingCatalogProducts.filter((candidate) => candidate.handle === catalogProduct.handle),
      `products with handle "${catalogProduct.handle}"`
    );

    if (!existingProduct) {
      const { result: createdProducts } = await createProductsWorkflow(container).run({
        input: {
          products: [
            buildCreateCatalogProductInput({
              product: catalogProduct,
              shippingProfileId: shippingProfile.id,
              salesChannelId: defaultSalesChannel.id,
            }),
          ],
        },
      });

      const createdProduct = createdProducts[0] as ProductRecord | undefined;

      if (!createdProduct?.id) {
        throw new Error(`Catalog product "${catalogProduct.title}" was not created.`);
      }

      logger.info(`Created catalog product "${catalogProduct.title}".`);

      await ensureWorkflowLink(
        `sales channel to catalog product "${catalogProduct.title}"`,
        async () => {
          await linkProductsToSalesChannelWorkflow(container).run({
            input: {
              id: defaultSalesChannel.id,
              add: [createdProduct.id],
            },
          });
        }
      );

      continue;
    }

    await updateProductsWorkflow(container).run({
      input: {
        products: [
          buildUpdateCatalogProductInput({
            existingProduct,
            product: catalogProduct,
            shippingProfileId: shippingProfile.id,
          }),
        ],
      },
    });

    logger.info(`Updated catalog product "${catalogProduct.title}".`);

    await ensureWorkflowLink(
      `sales channel to catalog product "${catalogProduct.title}"`,
      async () => {
        await linkProductsToSalesChannelWorkflow(container).run({
          input: {
            id: defaultSalesChannel.id,
            add: [existingProduct.id],
          },
        });
      }
    );
  }

  const { data: materializedProductsData } = await query.graph({
    entity: "product",
    fields: catalogProductFields,
  });

  const materializedCatalogProducts =
    ((materializedProductsData as ProductRecord[] | undefined) ?? []).filter((product) =>
      catalogHandles.has(product.handle ?? "")
    );

  for (const catalogProduct of SHOPPER_FACING_CATALOG) {
    const materializedProduct = ensureUniqueMatch(
      materializedCatalogProducts.filter((candidate) => candidate.handle === catalogProduct.handle),
      `materialized products with handle "${catalogProduct.handle}"`
    );

    if (!materializedProduct?.id) {
      throw new Error(`Catalog product "${catalogProduct.title}" is missing after seed.`);
    }

    if (!materializedProduct.thumbnail) {
      throw new Error(`Catalog product "${catalogProduct.title}" is missing a thumbnail.`);
    }

    if ((materializedProduct.images?.length ?? 0) < 1) {
      throw new Error(`Catalog product "${catalogProduct.title}" is missing product images.`);
    }

    if ((materializedProduct.variants?.length ?? 0) < catalogProduct.variants.length) {
      throw new Error(
        `Catalog product "${catalogProduct.title}" is missing seeded variants after bootstrap.`
      );
    }

    logger.info(
      `Catalog ready: ${catalogProduct.title} (${materializedProduct.handle}) with ${materializedProduct.variants?.length ?? 0} variant(s) and ${materializedProduct.images?.length ?? 0} image(s).`
    );
  }
  logger.info(`Shopper-facing catalog ready with ${SHOPPER_FACING_CATALOG.length} product(s).`);

  logger.info("Seeding publishable API key data...");
  const { data: apiKeysData } = await query.graph({
    entity: "api_key",
    fields: ["id", "title", "token"],
    filters: {
      type: "publishable",
    },
  });

  const publishableApiKeys = (apiKeysData as ApiKey[] | undefined) ?? [];
  const titledPublishableKeys = publishableApiKeys.filter(
    (candidate) => candidate.title === DEFAULT_PUBLISHABLE_KEY_TITLE
  );

  let publishableApiKey = ensureUniqueMatch(
    titledPublishableKeys,
    `publishable API keys titled "${DEFAULT_PUBLISHABLE_KEY_TITLE}"`
  );

  if (!publishableApiKey) {
    if (publishableApiKeys.length === 0) {
      const {
        result: [publishableApiKeyResult],
      } = await createApiKeysWorkflow(container).run({
        input: {
          api_keys: [
            {
              title: DEFAULT_PUBLISHABLE_KEY_TITLE,
              type: "publishable",
              created_by: "",
            },
          ],
        },
      });

      publishableApiKey = publishableApiKeyResult as ApiKey;
      logger.info(`Created publishable API key "${DEFAULT_PUBLISHABLE_KEY_TITLE}".`);
    } else if (publishableApiKeys.length === 1) {
      publishableApiKey = publishableApiKeys[0];
      logger.warn(
        `Reusing existing publishable API key "${publishableApiKey.title}" because it is the only publishable key on this database.`
      );
    } else {
      throw new Error(
        `Bootstrap found multiple publishable API keys without a baseline title match. ${BASELINE_HARDENING_HINT}`
      );
    }
  } else {
    logger.info(`Reusing publishable API key "${publishableApiKey.title}".`);
  }

  await ensureWorkflowLink("sales channel to publishable API key", async () => {
    await linkSalesChannelsToApiKeyWorkflow(container).run({
      input: {
        id: publishableApiKey.id,
        add: [defaultSalesChannel.id],
      },
    });
  });
  logger.info(`ROOT_BOOTSTRAP_PUBLISHABLE_KEY=${publishableApiKey.token}`);
  logger.info("Finished seeding publishable API key data.");
}
