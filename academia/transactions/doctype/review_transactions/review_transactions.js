// Copyright (c) 2025, SanU and contributors
// For license information, please see license.txt

frappe.ui.form.on("Review Transactions", {
    on_submit: function (frm){
        frappe.call({
			method: "frappe.client.get",
			args: {
				doctype: "Transaction New",
				filters: {
					name: frm.doc.transaction_reference,
				},
			},
			callback: function (response) {
				if (response.message) {
					let transaction_new_doc = response.message;
					transaction_new_doc.related_documents.push({
						document_name: frm.doc.name,
						document_type: frm.doc.doctype,
						document_title: frm.doc.title,
						document_status: frm.doc.status,
					});
					frappe.call({
						method: "frappe.client.save",
						args: {
							doc: transaction_new_doc,
						},
						callback: function (save_response) {
							if (save_response.message) {
								frappe.set_route(
									"Form",
									"Transaction New",
									frm.doc.transaction_reference
								);
							}
						},
					});
				}
			},
		});
    },
    onload: function(frm) {
        if (!frm.doc.start_from) {
            // Fetch the Employee record where user_id matches the logged-in user
            frappe.db.get_value('Employee', { 'user_id': frappe.session.user }, 'name', function(result) {
                if (result && result.name) {
                    frm.set_value('start_from', result.name);  // Set the employee field to the Employee name
                }
            });
        }
        // Set the current_action_maker field to the session user
        if (!frm.doc.current_action_maker) {
            frm.set_value('current_action_maker', frappe.session.user);  // Set current_action_maker to session user
        }
    },
    refresh: function (frm) {
        // Set get_query for the child table field
        frm.fields_dict["transactions_for_review"].grid.get_field("document_name").get_query = function () {
            console.log("Applying filter: docstatus = 1");
            return {
                filters: {
                    docstatus: 1, // Show only submitted documents
                    transaction_reference: frm.doc.transaction_reference // Match parent's transaction_reference
                }
            };
        };
        if (
			frm.doc.docstatus == 1 &&
			frm.doc.status == "Pending"
		) {
			add_approve_action(frm);
			add_reject_action(frm);
		}
    }
});

frappe.ui.form.on("Transactions For Review", {

    document_type: function (frm, cdt, cdn) {
		let child = locals[cdt][cdn];
		frappe.model.set_value(cdt, cdn, "document_name", "");
		frappe.model.set_value(cdt, cdn, "document_title", "");
		frappe.model.set_value(cdt, cdn, "notes", "");
	},
    
    document_name: function (frm, cdt, cdn) {
        console.log("Triggered document_name");
        let child = locals[cdt][cdn];
        console.log("Child Object:", child);

        if (child.document_type) {
            frappe.db.get_value(
                child.document_type,
                child.document_name,
                "title",
                function (r) {
                    console.log("Response:", r);
                    if (r) {
                        frappe.model.set_value(cdt, cdn, "document_title", r.title);
                    } else {
                        frappe.msgprint(
                            `Title not found for the selected ${child.document_type}.`
                        );
                    }
                }
            );
        } else {
            frappe.msgprint("Please select a Document Type first.");
        }
    },
});

function add_approve_action(frm){
    cur_frm.page.add_action_item(__("Approve"), function () {
    frappe.db.set_value(
        "Review Transactions",
		frm.docname,
        "status",
        "Completed"
    )
    .then(() => {
        location.reload();
    });
})}

function add_reject_action(frm){
    cur_frm.page.add_action_item(__("Reject"), function () {
    frappe.db.set_value(
        "Review Transactions",
		frm.docname,
        "status",
        "Rejected"
    )
    .then(() => {
        location.reload();
    });
})}