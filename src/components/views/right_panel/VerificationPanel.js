/*
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React from "react";
import PropTypes from "prop-types";

import * as sdk from '../../../index';
import {verificationMethods} from 'matrix-js-sdk/src/crypto';
import {SCAN_QR_CODE_METHOD} from "matrix-js-sdk/src/crypto/verification/QRCode";

import VerificationQRCode from "../elements/crypto/VerificationQRCode";
import {_t} from "../../../languageHandler";
import E2EIcon from "../rooms/E2EIcon";
import {
    PHASE_UNSENT,
    PHASE_REQUESTED,
    PHASE_READY,
    PHASE_DONE,
    PHASE_STARTED,
    PHASE_CANCELLED,
} from "matrix-js-sdk/src/crypto/verification/request/VerificationRequest";
import Spinner from "../elements/Spinner";

export default class VerificationPanel extends React.PureComponent {
    static propTypes = {
        layout: PropTypes.string,
        request: PropTypes.object.isRequired,
        member: PropTypes.object.isRequired,
        phase: PropTypes.oneOf([
            PHASE_UNSENT,
            PHASE_REQUESTED,
            PHASE_READY,
            PHASE_STARTED,
            PHASE_CANCELLED,
            PHASE_DONE,
        ]).isRequired,
        onClose: PropTypes.func.isRequired,
        isRoomEncrypted: PropTypes.bool,
    };

    constructor(props) {
        super(props);
        this.state = {};
        this._hasVerifier = false;
    }

    renderQRPhase() {
        const {member, request} = this.props;
        const showSAS = request.otherPartySupportsMethod(verificationMethods.SAS);
        const showQR = request.otherPartySupportsMethod(SCAN_QR_CODE_METHOD);
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');

        const noCommonMethodError = !showSAS && !showQR ?
            <p>{_t("The session you are trying to verify doesn't support scanning a QR code or emoji verification, which is what Riot supports. Try with a different client.")}</p> :
            null;

        if (this.props.layout === 'dialog') {
            // HACK: This is a terrible idea.
            let qrBlock;
            let sasBlock;
            if (showQR) {
                qrBlock =
                    <div className='mx_VerificationPanel_QRPhase_startOption'>
                        <p>{_t("Scan this unique code")}</p>
                        <VerificationQRCode qrCodeData={request.qrCodeData} />
                    </div>;
            }
            if (showSAS) {
                sasBlock =
                    <div className='mx_VerificationPanel_QRPhase_startOption'>
                        <p>{_t("Compare unique emoji")}</p>
                        <span className='mx_VerificationPanel_QRPhase_helpText'>{_t("Compare a unique set of emoji if you don't have a camera on either device")}</span>
                        <AccessibleButton disabled={this.state.emojiButtonClicked} onClick={this._startSAS} kind='primary'>
                            {_t("Start")}
                        </AccessibleButton>
                    </div>;
            }
            const or = qrBlock && sasBlock ?
                <div className='mx_VerificationPanel_QRPhase_betweenText'>{_t("or")}</div> : null;
            return (
                <div>
                    {_t("Verify this session by completing one of the following:")}
                    <div className='mx_VerificationPanel_QRPhase_startOptions'>
                        {qrBlock}
                        {or}
                        {sasBlock}
                        {noCommonMethodError}
                    </div>
                </div>
            );
        }

        let qrBlock;
        if (showQR) {
            qrBlock = <div className="mx_UserInfo_container">
                <h3>{_t("Verify by scanning")}</h3>
                <p>{_t("Ask %(displayName)s to scan your code:", {
                    displayName: member.displayName || member.name || member.userId,
                })}</p>

                <div className="mx_VerificationPanel_qrCode">
                    <VerificationQRCode qrCodeData={request.qrCodeData} />
                </div>
            </div>;
        }

        let sasBlock;
        if (showSAS) {
            const disabled = this.state.emojiButtonClicked;
            const sasLabel = showQR ?
                _t("If you can't scan the code above, verify by comparing unique emoji.") :
                _t("Verify by comparing unique emoji.");
            sasBlock = <div className="mx_UserInfo_container">
                <h3>{_t("Verify by emoji")}</h3>
                <p>{sasLabel}</p>
                <AccessibleButton disabled={disabled} kind="primary" className="mx_UserInfo_wideButton" onClick={this._startSAS}>
                    {_t("Verify by emoji")}
                </AccessibleButton>
            </div>;
        }

        const noCommonMethodBlock = noCommonMethodError ?
             <div className="mx_UserInfo_container">{noCommonMethodError}</div> :
             null;

        // TODO: add way to open camera to scan a QR code
        return <React.Fragment>
            {qrBlock}
            {sasBlock}
            {noCommonMethodBlock}
        </React.Fragment>;
    }

    renderQRReciprocatePhase() {
        const {member} = this.props;
        const FormButton = sdk.getComponent("elements.FormButton");

        let body;
        if (this.state.reciprocateQREvent) {
            // riot web doesn't support scanning yet, so assume here we're the client being scanned.
            body = <React.Fragment>
                <p>{_t("Almost there! Is %(displayName)s show the same shield?", {
                        displayName: member.displayName || member.name || member.userId,
                    })}</p>
                <E2EIcon isUser={true} status="verified" size={128} hideTooltip={true} />
                <p><FormButton label={_t("No")} kind="danger" onClick={this.state.reciprocateQREvent.cancel} /></p>
                <p><FormButton label={_t("Yes")} onClick={this.state.reciprocateQREvent.confirm} /></p>
            </React.Fragment>;
        } else {
            body = <p><Spinner/></p>;
        }
        return <div className="mx_UserInfo_container mx_VerificationPanel_verified_section">
            <h3>{_t("Verify by scanning")}</h3>
            { body }
        </div>;
    }

    renderVerifiedPhase() {
        const {member} = this.props;

        let text;
        if (this.props.isRoomEncrypted) {
            text = _t("Verify all users in a room to ensure it's secure.");
        } else {
            text = _t("In encrypted rooms, verify all users to ensure it’s secure.");
        }

        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
        return (
            <div className="mx_UserInfo_container mx_VerificationPanel_verified_section">
                <h3>{_t("Verified")}</h3>
                <p>{_t("You've successfully verified %(displayName)s!", {
                    displayName: member.displayName || member.name || member.userId,
                })}</p>
                <E2EIcon isUser={true} status="verified" size={128} hideTooltip={true} />
                <p>{ text }</p>

                <AccessibleButton kind="primary" className="mx_UserInfo_wideButton" onClick={this.props.onClose}>
                    {_t("Got it")}
                </AccessibleButton>
            </div>
        );
    }

    renderCancelledPhase() {
        const {member, request} = this.props;

        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');

        let text;
        if (request.cancellationCode === "m.timeout") {
            text = _t("Verification timed out. Start verification again from their profile.");
        } else if (request.cancellingUserId === request.otherUserId) {
            text = _t("%(displayName)s cancelled verification. Start verification again from their profile.", {
                displayName: member.displayName || member.name || member.userId,
            });
        } else {
            text = _t("You cancelled verification. Start verification again from their profile.");
        }

        return (
            <div className="mx_UserInfo_container">
                <h3>{_t("Verification cancelled")}</h3>
                <p>{ text }</p>

                <AccessibleButton kind="primary" className="mx_UserInfo_wideButton" onClick={this.props.onClose}>
                    {_t("Got it")}
                </AccessibleButton>
            </div>
        );
    }

    render() {
        const {member, phase, request} = this.props;

        const displayName = member.displayName || member.name || member.userId;

        switch (phase) {
            case PHASE_READY:
                return this.renderQRPhase();
            case PHASE_STARTED:
                switch (request.chosenMethod) {
                    case verificationMethods.RECIPROCATE_QR_CODE:
                        return this.renderQRReciprocatePhase();
                    case verificationMethods.SAS: {
                        const VerificationShowSas = sdk.getComponent('views.verification.VerificationShowSas');
                        const emojis = this.state.sasEvent ?
                            <VerificationShowSas
                                displayName={displayName}
                                sas={this.state.sasEvent.sas}
                                onCancel={this._onSasMismatchesClick}
                                onDone={this._onSasMatchesClick}
                                inDialog={this.props.inDialog}
                            /> : <Spinner />;
                        return <div className="mx_UserInfo_container">
                            <h3>{_t("Compare emoji")}</h3>
                            { emojis }
                        </div>;
                    }
                    default:
                        return null;
                }
            case PHASE_DONE:
                return this.renderVerifiedPhase();
            case PHASE_CANCELLED:
                return this.renderCancelledPhase();
        }
        console.error("VerificationPanel unhandled phase:", phase);
        return null;
    }

    _startSAS = async () => {
        this.setState({emojiButtonClicked: true});
        const verifier = this.props.request.beginKeyVerification(verificationMethods.SAS);
        try {
            await verifier.verify();
        } catch (err) {
            console.error(err);
        }
    };

    _onSasMatchesClick = () => {
        this.state.sasEvent.confirm();
    };

    _onSasMismatchesClick = () => {
        this.state.sasEvent.mismatch();
    };

    _updateVerifierState = () => {
        const {request} = this.props;
        const {sasEvent, reciprocateQREvent} = request;
        request.verifier.off('show_sas', this._updateVerifierState);
        request.verifier.off('show_reciprocate_qr', this._updateVerifierState);
        this.setState({sasEvent, reciprocateQREvent});
    };

    _onRequestChange = async () => {
        const {request} = this.props;
        const hadVerifier = this._hasVerifier;
        this._hasVerifier = !!request.verifier;
        if (!hadVerifier && this._hasVerifier) {
            request.verifier.on('show_sas', this._updateVerifierState);
            request.verifier.on('show_reciprocate_qr', this._updateVerifierState);
            try {
                // on the requester side, this is also awaited in _startSAS,
                // but that's ok as verify should return the same promise.
                await request.verifier.verify();
            } catch (err) {
                console.error("error verify", err);
            }
        }
    };

    componentDidMount() {
        const {request} = this.props;
        request.on("change", this._onRequestChange);
        if (request.verifier) {
            const {request} = this.props;
            const {sasEvent, reciprocateQREvent} = request;
            this.setState({sasEvent, reciprocateQREvent});
        }
        this._onRequestChange();
    }

    componentWillUnmount() {
        const {request} = this.props;
        if (request.verifier) {
            request.verifier.off('show_sas', this._updateVerifierState);
            request.verifier.off('show_reciprocate_qr', this._updateVerifierState);
        }
        request.off("change", this._onRequestChange);
    }
}
