/* tslint:disable */
/* eslint-disable */
/**
 * sts
 *
 * OpenAPI spec version: common-version
 */

import { CredentialsForAssumeRoleOutput } from "./credentials-for-assume-role-output";
import { AssumedRoleUserForAssumeRoleOutput } from "./assumed-role-user-for-assume-role-output";
import { OIDCTokenInfoForAssumeRoleWithOIDCOutput } from "./oidc-token-info-for-assume-role-with-oidc-output";

/**
 * AssumeRoleWithOIDC 响应结果。
 *
 * @see https://www.volcengine.com/docs/6257/1494877
 * @export
 * @interface AssumeRoleWithOIDCResponse
 */
export interface AssumeRoleWithOIDCResponse {

    /**
     * 角色扮演产生的临时安全凭证。
     *
     * @type {CredentialsForAssumeRoleOutput}
     * @memberof AssumeRoleWithOIDCResponse
     */
    Credentials?: CredentialsForAssumeRoleOutput;

    /**
     * OIDC Token 信息。
     *
     * @type {OIDCTokenInfoForAssumeRoleWithOIDCOutput}
     * @memberof AssumeRoleWithOIDCResponse
     */
    OIDCTokenInfo?: OIDCTokenInfoForAssumeRoleWithOIDCOutput;

    /**
     * 角色扮演的基本信息。
     *
     * @type {AssumedRoleUserForAssumeRoleOutput}
     * @memberof AssumeRoleWithOIDCResponse
     */
    AssumedRoleUser?: AssumedRoleUserForAssumeRoleOutput;
}
