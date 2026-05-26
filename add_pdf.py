content = open('/home/ec2-user/amc-deployment/routes/vaultAccessRoutes.js').read()

# Add pdfkit require at the top
content = content.replace(
    "'use strict';\n\nconst express      = require('express');",
    "'use strict';\n\nconst express      = require('express');\nconst PDFDocument  = require('pdfkit');\nconst fs           = require('fs');\nconst fspath       = require('path');"
)

old_block = """    // Notify vault creator if they opted in
    if (vault.notifyClientOnNda) {
      try {
        const creator = await User.findById(vault.user).select('email firstName name').lean();
        if (creator && creator.email) {
          const creatorName = creator.firstName || creator.name || creator.email;
          const journalistName = userName || userEmail;
          await mailer.sendMail({
            from: '"AutoMediaVault" <noreply@automediacenter.com>',
            to: creator.email,
            subject: `NDA signed — ${vault.title}`,
            html: `<div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;">
              <div style="background:#1e293b;padding:24px 28px;border-radius:8px 8px 0 0;">
                <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">AutoMediaCenter</p>
                <h1 style="margin:6px 0 0;font-size:22px;font-weight:800;color:#ffffff;">NDA Signed</h1>
              </div>
              <div style="background:#ffffff;padding:28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
                <p style="margin:0 0 16px;font-size:14px;color:#475569;">Hi ${creatorName},</p>
                <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
                  <strong>${journalistName}</strong> has signed the NDA for your Media Vault:<br>
                  <strong>${vault.title}</strong>
                </p>
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:16px 18px;margin:0 0 20px;">
                  <p style="margin:0 0 6px;font-size:12px;color:#64748b;">Signed by: ${journalistName} (${userEmail})</p>
                  <p style="margin:0 0 6px;font-size:12px;color:#64748b;">Signed at: ${now.toLocaleString('en-GB', {day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit',timeZoneName:'short'})}</p>
                  <p style="margin:0;font-size:12px;color:#64748b;">IP address: ${ip}</p>
                </div>
                <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">
                  The vault password has been dispatched to the journalist. This notification was sent because you enabled NDA notifications for this vault.
                </p>
              </div>
            </div>`
          });
          console.log(`[VAULT] NDA notification sent to creator: ${creator.email}`);
        }
      } catch (ndaNotifyErr) {
        console.error('[VAULT] NDA notification error:', ndaNotifyErr.message);
      }
    }"""

new_block = """    // Generate signed NDA PDF, email journalist and optionally notify creator
    try {
      const embargoStr = vault.embargoUntil
        ? new Date(vault.embargoUntil).toLocaleString('en-GB', {
            day: '2-digit', month: 'long', year: 'numeric',
            hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
          })
        : 'As specified in the vault';

      const signedAtStr = now.toLocaleString('en-GB', {
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
      });

      // Generate PDF in memory
      const pdfBuffer = await new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const buffers = [];
        doc.on('data', chunk => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        // Header bar
        doc.rect(0, 0, doc.page.width, 80).fill('#1e293b');
        doc.fillColor('#94a3b8').fontSize(9).font('Helvetica-Bold')
           .text('AUTOMEDIACENTER', 50, 28, { characterSpacing: 1.5 });
        doc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold')
           .text('Non-Disclosure Agreement', 50, 46);
        doc.fillColor('#0f172a');

        doc.moveDown(3.5);
        doc.fontSize(15).font('Helvetica-Bold').fillColor('#0f172a')
           .text('SIGNED NDA CERTIFICATE', { align: 'center' });
        doc.moveDown(0.4);
        doc.fontSize(10).font('Helvetica').fillColor('#64748b')
           .text('This document certifies that the following party has agreed to the Non-Disclosure Agreement', { align: 'center' });
        doc.text('governing access to the Media Vault described below.', { align: 'center' });

        doc.moveDown(1);
        doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor('#e2e8f0').stroke();
        doc.moveDown(1);

        doc.fontSize(9).font('Helvetica-Bold').fillColor('#94a3b8').text('MEDIA VAULT');
        doc.moveDown(0.3);
        doc.fontSize(13).font('Helvetica-Bold').fillColor('#0f172a').text(vault.title);
        doc.moveDown(0.4);
        doc.fontSize(10).font('Helvetica').fillColor('#dc2626')
           .text('EMBARGO DATE: ' + embargoStr, { font: 'Helvetica-Bold' });
        doc.moveDown(1);

        doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor('#e2e8f0').stroke();
        doc.moveDown(1);

        doc.fontSize(9).font('Helvetica-Bold').fillColor('#94a3b8').text('SIGNATORY DETAILS');
        doc.moveDown(0.5);
        const rows = [
          ['Full Name',       signatureName],
          ['Email Address',   userEmail],
          ['Signed At',       signedAtStr],
          ['IP Address',      ip],
          ['Device / Browser', ua.substring(0, 80)],
        ];
        rows.forEach(([label, value]) => {
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#64748b').text(label + ':');
          doc.fontSize(10).font('Helvetica').fillColor('#0f172a').text(value);
          doc.moveDown(0.4);
        });

        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor('#e2e8f0').stroke();
        doc.moveDown(1);

        doc.fontSize(9).font('Helvetica-Bold').fillColor('#94a3b8').text('AGREED TERMS');
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica').fillColor('#374151').text(
          '1. CONFIDENTIALITY. The signatory agrees to keep all content accessed through this Media Vault strictly confidential and not to disclose, publish, broadcast, or otherwise make available any content to any third party prior to the embargo date and time specified above.\n\n' +
          '2. EMBARGO. The signatory agrees not to publish, broadcast, or otherwise make public any content from this Media Vault before the embargo date and time. Breach of embargo constitutes a material breach of this agreement.\n\n' +
          '3. PERMITTED USE. Content from this Media Vault may only be used for editorial, journalistic, or media purposes directly related to the subject matter of the vault. Commercial use is prohibited without express written consent.\n\n' +
          '4. WATERMARKING & TRACKING. The signatory acknowledges that all downloaded assets are watermarked with their identity, IP address, and timestamp. All access and download activity is logged as part of an immutable audit record.\n\n' +
          '5. LIABILITY. Breach of this agreement may result in legal action. The signatory accepts full liability for any loss or damage caused by unauthorised disclosure or pre-embargo publication.\n\n' +
          '6. GOVERNING LAW. This agreement is governed by the laws of the jurisdiction in which AutoMediaCenter operates.',
          { lineGap: 3 }
        );

        doc.moveDown(1.5);
        doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor('#e2e8f0').stroke();
        doc.moveDown(1);

        doc.fontSize(9).font('Helvetica-Bold').fillColor('#94a3b8').text('DIGITAL SIGNATURE');
        doc.moveDown(0.5);
        doc.fontSize(20).font('Helvetica-Oblique').fillColor('#1e293b').text(signatureName);
        doc.moveDown(0.3);
        doc.fontSize(9).font('Helvetica').fillColor('#64748b')
           .text('Digitally signed on ' + signedAtStr);
        doc.moveDown(0.2);
        doc.text('Recorded by AutoMediaCenter at IP address ' + ip);

        doc.moveDown(2);
        doc.fontSize(8).font('Helvetica').fillColor('#94a3b8')
           .text('This document was automatically generated by AutoMediaCenter · automediacenter.com', { align: 'center' });
        doc.text('It constitutes a legally binding record of the NDA signed by the above party.', { align: 'center' });

        doc.end();
      });

      // Save PDF to disk
      const ndaDir = fspath.join(__dirname, '..', 'uploads', 'vault_assets', 'nda_signed');
      if (!fs.existsSync(ndaDir)) fs.mkdirSync(ndaDir, { recursive: true });
      const pdfFilename = 'nda_' + vaultId + '_' + userId + '_' + Date.now() + '.pdf';
      const pdfPath = fspath.join(ndaDir, pdfFilename);
      fs.writeFileSync(pdfPath, pdfBuffer);

      // Store PDF path on VaultAccess record
      await VaultAccess.findOneAndUpdate(
        { userId, vaultId },
        { $set: { signedNdaPdfPath: 'uploads/vault_assets/nda_signed/' + pdfFilename } }
      );

      const pdfAttachment = {
        filename: 'NDA_Signed_' + vault.title.replace(/[^a-z0-9]/gi, '_').substring(0, 40) + '.pdf',
        content: pdfBuffer,
        contentType: 'application/pdf'
      };

      // Email PDF to journalist
      await mailer.sendMail({
        from: '"AutoMediaVault" <noreply@automediacenter.com>',
        to: userEmail,
        subject: 'Your signed NDA — ' + vault.title,
        html: '<div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;">' +
          '<div style="background:#1e293b;padding:24px 28px;border-radius:8px 8px 0 0;">' +
          '<p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">AutoMediaCenter</p>' +
          '<h1 style="margin:6px 0 0;font-size:20px;font-weight:800;color:#ffffff;">Your Signed NDA</h1>' +
          '</div>' +
          '<div style="background:#ffffff;padding:28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">' +
          '<p style="margin:0 0 16px;font-size:14px;color:#475569;">Hi ' + userName + ',</p>' +
          '<p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6;">Please find attached a copy of the Non-Disclosure Agreement you signed for:</p>' +
          '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:16px 18px;margin:0 0 20px;">' +
          '<p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#0f172a;">' + vault.title + '</p>' +
          '<p style="margin:0;font-size:12px;font-weight:700;color:#dc2626;">Embargo date: ' + embargoStr + '</p>' +
          '</div>' +
          '<p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6;">Keep this document for your records. The embargo date above is legally binding under the terms of this NDA. Do not publish any content from this vault before the embargo lifts.</p>' +
          '<p style="margin:0;font-size:11px;color:#94a3b8;">AutoMediaCenter · automediacenter.com · Do not forward this email.</p>' +
          '</div></div>',
        attachments: [pdfAttachment]
      });
      console.log('[VAULT] Signed NDA PDF sent to journalist: ' + userEmail);

      // Email PDF to creator if NDA notification enabled
      if (vault.notifyClientOnNda) {
        const creator = await User.findById(vault.user).select('email firstName name').lean();
        if (creator && creator.email) {
          const creatorName = creator.firstName || creator.name || creator.email;
          const journalistName = userName || userEmail;
          await mailer.sendMail({
            from: '"AutoMediaVault" <noreply@automediacenter.com>',
            to: creator.email,
            subject: 'NDA signed — ' + vault.title,
            html: '<div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;">' +
              '<div style="background:#1e293b;padding:24px 28px;border-radius:8px 8px 0 0;">' +
              '<p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">AutoMediaCenter</p>' +
              '<h1 style="margin:6px 0 0;font-size:22px;font-weight:800;color:#ffffff;">NDA Signed</h1>' +
              '</div>' +
              '<div style="background:#ffffff;padding:28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">' +
              '<p style="margin:0 0 16px;font-size:14px;color:#475569;">Hi ' + creatorName + ',</p>' +
              '<p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6;"><strong>' + journalistName + '</strong> has signed the NDA for your Media Vault:</p>' +
              '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:16px 18px;margin:0 0 20px;">' +
              '<p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#0f172a;">' + vault.title + '</p>' +
              '<p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#dc2626;">Embargo date: ' + embargoStr + '</p>' +
              '<p style="margin:0 0 4px;font-size:12px;color:#64748b;">Signed by: ' + journalistName + ' (' + userEmail + ')</p>' +
              '<p style="margin:0 0 4px;font-size:12px;color:#64748b;">Signed at: ' + signedAtStr + '</p>' +
              '<p style="margin:0;font-size:12px;color:#64748b;">IP address: ' + ip + '</p>' +
              '</div>' +
              '<p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">The signed NDA PDF is attached to this email for your records. The vault password has been dispatched to the journalist.</p>' +
              '</div></div>',
            attachments: [pdfAttachment]
          });
          console.log('[VAULT] NDA notification + PDF sent to creator: ' + creator.email);
        }
      }

    } catch (pdfErr) {
      console.error('[VAULT] PDF generation/send error:', pdfErr.message);
    }"""

content = content.replace(old_block, new_block)
open('/home/ec2-user/amc-deployment/routes/vaultAccessRoutes.js', 'w').write(content)
print('Done')
