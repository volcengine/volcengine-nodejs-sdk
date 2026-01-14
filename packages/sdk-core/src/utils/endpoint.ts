// This file is a TypeScript translation of endpoint.go
// May have been modified by Beijing Volcanoengine Technology Ltd.

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { loadEnv } from "./env";

interface ServiceEndpointInfo {
  Service: string;
  IsGlobal: boolean;
  GlobalEndpoint?: string;
  RegionEndpointMap?: Record<string, string>;
}

const separator = ".";
const openPrefix = "open";
const endpointSuffix = separator + "volcengineapi.com";
const dualstackEndpointSuffix = separator + "volcengine-api.com";

const endpoint = openPrefix + endpointSuffix;

const regionCodeCNBeijingAutoDriving = "cn-beijing-autodriving";
const regionCodeAPSouthEast2 = "ap-southeast-2";
const regionCodeAPSouthEast3 = "ap-southeast-3";
const regionCodeCNShanghaiAutoDriving = "cn-shanghai-autodriving";
const regionCodeCNBeijingSelfdrive = "cn-beijing-selfdrive";

const defaultEndpoint: Record<string, ServiceEndpointInfo> = {
  vpc: { Service: "vpc", IsGlobal: false },
  ecs: { Service: "ecs", IsGlobal: false },
  billing: { Service: "billing", IsGlobal: true },
  ark: { Service: "ark", IsGlobal: false },
  iam: { Service: "iam", IsGlobal: true },
  mcs: { Service: "mcs", IsGlobal: false },
  rocketmq: { Service: "rocketmq", IsGlobal: false },
  bytehouse: { Service: "bytehouse", IsGlobal: false },
  dns: { Service: "dns", IsGlobal: true },
  autoscaling: { Service: "autoscaling", IsGlobal: false },
  spark: { Service: "spark", IsGlobal: false },
  cloud_detect: { Service: "cloud_detect", IsGlobal: false },
  filenas: { Service: "filenas", IsGlobal: false },
  escloud: { Service: "escloud", IsGlobal: false },
  flink: { Service: "flink", IsGlobal: false },
  cp: { Service: "cp", IsGlobal: false },
  vefaas: { Service: "vefaas", IsGlobal: false },
  ml_platform: { Service: "ml_platform", IsGlobal: false },
  edx: { Service: "edx", IsGlobal: true },
  dcdn: { Service: "dcdn", IsGlobal: true },
  cdn: { Service: "cdn", IsGlobal: true },
  kafka: { Service: "kafka", IsGlobal: false },
  certificate_service: { Service: "certificate_service", IsGlobal: true },
  waf: { Service: "waf", IsGlobal: true },
  rds_mssql: { Service: "rds_mssql", IsGlobal: false },
  cloudtrail: { Service: "cloudtrail", IsGlobal: false },
  vei_api: { Service: "vei_api", IsGlobal: true },
  cen: { Service: "cen", IsGlobal: true },
  rabbitmq: { Service: "rabbitmq", IsGlobal: false },
  vmp: { Service: "vmp", IsGlobal: false },
  volc_observe: { Service: "volc_observe", IsGlobal: false },
  dataleap: { Service: "dataleap", IsGlobal: false },
  fw_center: { Service: "fw_center", IsGlobal: true },
  redis: { Service: "redis", IsGlobal: false },
  mcdn: { Service: "mcdn", IsGlobal: true },
  cloudidentity: { Service: "cloudidentity", IsGlobal: false },
  vedbm: { Service: "vedbm", IsGlobal: false },
  cv: { Service: "cv", IsGlobal: true },
  translate: { Service: "translate", IsGlobal: true },
  cloud_trail: { Service: "cloud_trail", IsGlobal: false },
  bio: { Service: "bio", IsGlobal: false },
  nta: { Service: "nta", IsGlobal: true },
  elasticmapreduce: { Service: "elasticmapreduce", IsGlobal: false },
  vepfs: { Service: "vepfs", IsGlobal: false },
  seccenter: { Service: "seccenter", IsGlobal: true },
  advdefence: { Service: "advdefence", IsGlobal: true },
  tis: { Service: "tis", IsGlobal: true },
  organization: { Service: "organization", IsGlobal: true },
  vke: { Service: "vke", IsGlobal: false },
  Redis: { Service: "Redis", IsGlobal: false },
  privatelink: { Service: "privatelink", IsGlobal: false },
  RocketMQ: { Service: "RocketMQ", IsGlobal: false },
  Kafka: { Service: "Kafka", IsGlobal: false },
  rds_mysql: { Service: "rds_mysql", IsGlobal: false },
  rds_postgresql: { Service: "rds_postgresql", IsGlobal: false },
  storage_ebs: { Service: "storage_ebs", IsGlobal: false },
  clb: { Service: "clb", IsGlobal: false },
  alb: { Service: "alb", IsGlobal: false },
  FileNAS: { Service: "FileNAS", IsGlobal: false },
  configcenter: { Service: "configcenter", IsGlobal: false },
  cr: { Service: "cr", IsGlobal: false },
  sts: { Service: "sts", IsGlobal: false },
  mongodb: { Service: "mongodb", IsGlobal: false },
  transitrouter: { Service: "transitrouter", IsGlobal: false },
  Volc_Observe: { Service: "Volc_Observe", IsGlobal: false },
  dms: { Service: "dms", IsGlobal: false },
  auto_scaling: { Service: "auto_scaling", IsGlobal: false },
  directconnect: { Service: "directconnect", IsGlobal: false },
  kms: { Service: "kms", IsGlobal: false },
  dbw: { Service: "dbw", IsGlobal: false },
  dts: { Service: "dts", IsGlobal: false },
  natgateway: { Service: "natgateway", IsGlobal: false },
  tos: { Service: "tos", IsGlobal: false },
  TLS: { Service: "TLS", IsGlobal: false },
  vpn: { Service: "vpn", IsGlobal: false },
  vod: { Service: "vod", IsGlobal: false },
  quota: { Service: "quota", IsGlobal: true },
  ecs_ops: { Service: "ecs_ops", IsGlobal: true },
  as_ops: { Service: "as_ops", IsGlobal: true },
  account_management: { Service: "account_management", IsGlobal: true },
  account_management_byteplus: {
    Service: "account_management_byteplus",
    IsGlobal: true,
  },
  bandwidthquota: { Service: "bandwidthquota", IsGlobal: true },
  psa_manager: { Service: "psa_manager", IsGlobal: true },
  dc_controller: { Service: "dc_controller", IsGlobal: false },
  eps_platform_trade: { Service: "eps_platform_trade", IsGlobal: false },
  eps_platform_fund: { Service: "eps_platform_fund", IsGlobal: false },
  commercialization: { Service: "commercialization", IsGlobal: true },
  veecp_openapi: { Service: "veecp_openapi", IsGlobal: false },
  orgnization: { Service: "orgnization", IsGlobal: true },
  coze: { Service: "coze", IsGlobal: true },
  sec_agent: { Service: "sec_agent", IsGlobal: true },
  sec_intelligent_dev: { Service: "sec_intelligent_dev", IsGlobal: true },
  vegame: { Service: "vegame", IsGlobal: false },
  acep: { Service: "acep", IsGlobal: true },
  private_zone: { Service: "private_zone", IsGlobal: true },
  sqs: { Service: "sqs", IsGlobal: false },
  resourcecenter: { Service: "resourcecenter", IsGlobal: true },
  aiotvideo: { Service: "aiotvideo", IsGlobal: true },
  apig: { Service: "apig", IsGlobal: false },
  bmq: { Service: "bmq", IsGlobal: false },
  bytehouse_ce: { Service: "bytehouse_ce", IsGlobal: false },
  cloudmonitor: { Service: "cloudmonitor", IsGlobal: false },
  emr: { Service: "emr", IsGlobal: false },
  ga: { Service: "ga", IsGlobal: true },
  graph: { Service: "graph", IsGlobal: false },
  gtm: { Service: "gtm", IsGlobal: true },
  hbase: { Service: "hbase", IsGlobal: false },
  metakms: { Service: "metakms", IsGlobal: false },
  na: { Service: "na", IsGlobal: true },
  resource_share: { Service: "resource_share", IsGlobal: true },
  speech_saas_prod: { Service: "speech_saas_prod", IsGlobal: true },
  tag: { Service: "tag", IsGlobal: true },
  vefaas_dev: { Service: "vefaas_dev", IsGlobal: false },
  vms: { Service: "vms", IsGlobal: false },
  eco_partner: { Service: "eco_partner", IsGlobal: true },
  smc: { Service: "smc", IsGlobal: true },
};

const bootstrapRegion: Record<string, unknown> = {
  [regionCodeCNBeijingAutoDriving]: {},
  [regionCodeAPSouthEast2]: {},
  [regionCodeAPSouthEast3]: {},
  [regionCodeCNShanghaiAutoDriving]: {},
  [regionCodeCNBeijingSelfdrive]: {},
};

function standardizeDomainServiceCode(serviceCode: string): string {
  return serviceCode.toLowerCase().replace(/_/g, "-");
}

function inBootstrapRegionList(
  regionCode: string,
  customBootstrapRegion?: Record<string, unknown>
): boolean {
  regionCode = regionCode.trim();

  const bsRegionListPath = loadEnv().bootstrapRegionListConf;
  if (bsRegionListPath) {
    try {
      // 读取引导区域列表文件内容
      const content = fs.readFileSync(path.resolve(bsRegionListPath), "utf8");
      const regions = content
        .split(os.EOL)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      if (regions.includes(regionCode)) {
        return true;
      }
    } catch (error) {
      // Ignore file read errors
    }
  }

  if (bootstrapRegion[regionCode]) {
    return true;
  }

  if (customBootstrapRegion && customBootstrapRegion[regionCode]) {
    return true;
  }

  return false;
}

function hasEnableDualStack(useDualStack?: boolean): boolean {
  if (useDualStack === undefined) {
    return Boolean(loadEnv().enableDualstack);
  }
  return useDualStack;
}

export function getDefaultEndpointByServiceInfo(
  service: string,
  regionCode: string,
  customBootstrapRegion?: Record<string, unknown>,
  useDualStack?: boolean
): string | null {
  let resultEndpoint = endpoint;

  // 非引导区域，返回默认 endpoint
  if (!inBootstrapRegionList(regionCode, customBootstrapRegion)) {
    return resultEndpoint;
  }

  const defaultEndpointInfo = defaultEndpoint[service];

  // 服务不存在默认 endpoint，返回默认 endpoint
  if (!defaultEndpointInfo) {
    return resultEndpoint;
  }

  let suffix = endpointSuffix;

  // 双栈支持，返回双栈 endpoint
  if (hasEnableDualStack(useDualStack)) {
    suffix = dualstackEndpointSuffix;
  }

  if (defaultEndpointInfo.IsGlobal) {
    // if (defaultEndpointInfo.GlobalEndpoint) {
    //   resultEndpoint = defaultEndpointInfo.GlobalEndpoint;
    //   return resultEndpoint;
    // }
    resultEndpoint = standardizeDomainServiceCode(service) + suffix;
    return resultEndpoint;
  }

  // regional endpoint
  if (defaultEndpointInfo.RegionEndpointMap) {
    const regionEndpointStr = defaultEndpointInfo.RegionEndpointMap[regionCode];
    if (regionEndpointStr) {
      resultEndpoint = regionEndpointStr;

      return resultEndpoint;
    }
  }

  resultEndpoint =
    standardizeDomainServiceCode(service) + separator + regionCode + suffix;
  return resultEndpoint;
}

export { ServiceEndpointInfo };
