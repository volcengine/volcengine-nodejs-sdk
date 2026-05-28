/* tslint:disable */
/* eslint-disable */
/**
 * sts
 *
 * OpenAPI spec version: common-version
 */

import { CredentialsForAssumeRoleOutput } from "./credentials-for-assume-role-output";
import { AssumedRoleUserForAssumeRoleOutput } from "./assumed-role-user-for-assume-role-output";
import { SAMLAssertionInfoForAssumeRoleWithSAMLOutput } from "./saml-assertion-info-for-assume-role-with-saml-output";

/**
 * AssumeRoleWithSAML 响应结果。
 *
 * @see https://www.volcengine.com/docs/6257/1631607
 * @export
 * @interface AssumeRoleWithSAMLResponse
 */
export interface AssumeRoleWithSAMLResponse {
  /**
   * 角色扮演产生的临时安全凭证。
   *
   * @type {CredentialsForAssumeRoleOutput}
   * @memberof AssumeRoleWithSAMLResponse
   */
  Credentials?: CredentialsForAssumeRoleOutput;

  /**
   * SAML 断言中的部分信息。
   *
   * @type {SAMLAssertionInfoForAssumeRoleWithSAMLOutput}
   * @memberof AssumeRoleWithSAMLResponse
   */
  SAMLAssertionInfo?: SAMLAssertionInfoForAssumeRoleWithSAMLOutput;

  /**
   * 角色扮演的基本信息。
   *
   * @type {AssumedRoleUserForAssumeRoleOutput}
   * @memberof AssumeRoleWithSAMLResponse
   */
  AssumedRoleUser?: AssumedRoleUserForAssumeRoleOutput;
}
