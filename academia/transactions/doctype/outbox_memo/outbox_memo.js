// Copyright (c) 2024, SanU and contributors
// For license information, please see license.txt
let mustInclude = [];
let global_current_employee = null;
let global_next_recipient = null;
let global_action_name = null;

frappe.ui.form.on("Outbox Memo", {
	on_submit: function (frm) {
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
	before_submit: function (frm) {
		if (
			(frm.doc.type === "Internal" && frm.doc.direction != "Downward") ||
			frm.doc.type != "Internal"
		) {
			frappe.call({
				method: "frappe.client.get_value",
				args: {
					doctype: "Employee",
					filters: { name: frm.doc.start_from },
					fieldname: "reports_to",
				},
				callback: function (response) {
					if (response.message) {
						reports_to = response.message.reports_to;
						frappe.call({
							method: "frappe.client.get_value",
							args: {
								doctype: "Employee",
								filters: { name: reports_to },
								fieldname: "user_id",
							},
							callback: function (response) {
								if (response.message) {
									user_id = response.message.user_id;
									frm.set_value("current_action_maker", user_id);
									frappe.db
										.set_value(
											"Transaction New",
											frm.doc.transaction_reference,
											"transaction_holder",
											user_id
										)
								}
							},
						});
					}
				},
			});
		} else if (frm.doc.type === "Internal" && frm.doc.direction === "Downward") {
			frm.set_value("current_action_maker", frm.doc.recipients[0].recipient_email);
			frappe.db
				.set_value(
					"Transaction New",
					frm.doc.transaction_reference,
					"transaction_holder",
					frm.doc.recipients[0].recipient_email
				)
		} else {
			console.log("External");
		}
	},

	refresh(frm) {
		console.log(mustInclude);
		if (!frappe.user_roles.includes("External Outbox Maker")) {
			frm.set_df_property("direction", "hidden", 1);
		}
		update_related_actions_html(frm);
		// Assign global variables
		frappe.call({
			method: "frappe.client.get_value",
			args: {
				doctype: "Employee",
				filters: { user_id: frappe.session.user },
				fieldname: ["name", "reports_to"],
			},
			callback: function (response) {
				if (response.message) {
					global_current_employee = response.message.name;
					if (
						(frm.doc.direction == "Upward" &&
							global_current_employee != frm.doc.recipients[0].recipient) ||
						(frm.doc.type == "External" &&
							global_current_employee != frm.doc.end_employee)
					) {
						global_next_recipient = response.message.reports_to;
					}
				}
			},
		});

		// Hide 'add row' button
		frm.get_field("recipients").grid.cannot_add_rows = true;
		// Stop 'add below' & 'add above' options
		frm.get_field("recipients").grid.only_sortable();
		frm.refresh_fields("recipients");

		if (frm.doc.docstatus != 0) {
			frm.fields_dict.get_recipients.$wrapper.hide();
			frm.fields_dict.get_recipients.input.disabled = true;
			frm.fields_dict.clear_recipients.$wrapper.hide();
			frm.fields_dict.clear_recipients.input.disabled = true;
		}
		if (
			frm.doc.current_action_maker === frappe.session.user &&
			(frm.doc.is_received || frm.doc.full_electronic)
		) {
			add_approve_action(frm);
			if (frm.doc.allow_to_redirect === 1) {
				add_redirect_action(frm);
			}
			if (frm.doc.direction !== "Downward") {
				add_reject_action(frm);
			}
			// add_reject_action(frm);
		}
	},

	onload: function (frm) {
		frm.fields_dict['end_employee'].get_query = function(doc) {
            return {
                query: "academia.transactions.doctype.outbox_memo.outbox_memo.get_end_employee",
                filters: {
                    role: "External Outbox Maker",
                    company: frm.doc.start_from_company,
                    current_employee: frm.doc.start_from
                }
            };
        };

		document.addEventListener("keydown", function (event) {
			// Check if the Ctrl + B combination is pressed
			if (event.ctrlKey && event.key === "b") {
				// Check if the current doctype is one of the specified doctypes
				if (frm.doctype === "Outbox Memo") {
					// Prevent the default action and stop propagation
					event.preventDefault();
					event.stopPropagation();
					frappe.msgprint(__("The shortcut Ctrl + B is disabled for this doctype."));
				}
			}
		});
		if (!frm.is_new()) {
			frm.set_df_property("direction", "hidden", 1);
		}
		const transaction_reference = localStorage.getItem("transaction_reference");

		// Set the transaction_reference field value if it exists
		if (transaction_reference && frm.is_new()) {
			frm.set_value("transaction_reference", transaction_reference);
		}
		update_related_actions_html(frm);
		if (!frm.doc.start_from) {
			frappe.call({
				method: "frappe.client.get_value",
				args: {
					doctype: "Employee",
					filters: { user_id: frappe.session.user },
					fieldname: "name",
				},
				callback: function (response) {
					if (response.message) {
						frm.set_value("start_from", response.message.name);
					}
				},
			});
		}
	},

	start_from: function (frm) {
		update_must_include(frm);
	},

	direction: function (frm) {
		update_must_include(frm);
	},

	type: function (frm) {
		update_must_include(frm);
	},

	get_recipients: function (frm) {
		update_must_include(frm);
		let setters = {
			employee_name: null,
			department: null,
			designation: null,
		};
		if (frm.doc.type == "External") {
			setters.company = null;
		}

		new frappe.ui.form.MultiSelectDialog({
			doctype: "Employee",
			target: frm,
			setters: setters,

			// add_filters_group: 1,
			// date_field: "transaction_date",
			get_query() {
				let filters = {
					docstatus: ["!=", 2],
					user_id: ["in", mustInclude],
				};
				if (frm.doc.type == "External") {
					filters.company = this.setters.company || "";
				}
				return {
					filters: filters,
				};
			},
			primary_action_label: __("Get Recipients"),

			action(selections) {
				if (selections.length > 1) {
					frappe.msgprint("You Can Only Select One Recipient");
					return;
				}
				// console.log(d.dialog.get_value("company"));
				// emptying Council members
				frm.set_value("recipients", []);
				// Hold employee names
				frappe.call({
					method: "frappe.client.get_list",
					args: {
						doctype: "Employee",
						filters: { name: ["in", selections] },
						fields: [
							"name",
							"employee_name",
							"designation",
							"department",
							"company",
							"user_id",
						],
					},
					callback: (response) => {
						var selectedEmployees = response.message;

						// frm.set_value('recipients', []);

						selectedEmployees.forEach((employee) => {
							frm.add_child("recipients", {
								recipient: employee.name, // Use document name instead of employee_name
								recipient_name: employee.employee_name,
								recipient_company: employee.company,
								recipient_department: employee.department,
								recipient_designation: employee.designation,
								recipient_email: employee.user_id,
							});
						});

						this.dialog.hide();

						frm.refresh_field("recipients");

						// // Hide the "Add" button for the recipients table if through_route is checked and there's a recipient
						// frm.get_field("recipients").grid.grid_buttons.find(".grid-add-row").toggle(!frm.doc.through_route || existingRecipients.length === 0);
					},
				});
			},
		});
	},

	clear_recipients: function (frm) {
		frm.clear_table("recipients");
		frm.refresh_field("recipients");
	},
});

function update_must_include(frm) {
	if (frm.doc.start_from) {
		frm.clear_table("recipients");
		frm.refresh_field("recipients");

		if (frm.doc.type === "External") {
			frappe.call({
				method: "academia.transactions.doctype.outbox_memo.outbox_memo.get_all_employees_except_start_from_company",
				args: {
					start_from_company: frm.doc.start_from_company,
				},
				callback: function (response) {
					mustInclude = []
					if (response.message && response.message.length > 0) {
						// Filter out null values and employees without users
						mustInclude = response.message.filter(emp => emp !== null);
					}
	
					// If mustInclude is empty, add a placeholder value
					if (mustInclude.length === 0) {
						mustInclude.push({ name: "No valid employees", employee_name: "No valid employees" });
					}
					console.log(mustInclude);
				},
			});
		} else if (frm.doc.type === "Internal" && frm.doc.direction !== "Downward") {
			frappe.call({
				method: "academia.transactions.doctype.outbox_memo.outbox_memo.get_reports_to_hierarchy",
				args: {
					employee_name: frm.doc.start_from,
				},
				callback: function (response) {
					mustInclude = []
					if (response.message && response.message.length > 0) {
						// Filter out null values and employees without users
						mustInclude = response.message.filter(emp => emp !== null);
					}
	
					// If mustInclude is empty, add a placeholder value
					if (mustInclude.length === 0) {
						mustInclude.push({ name: "No valid employees", employee_name: "No valid employees" });
					}
					console.log(mustInclude);

				},
			});
		} else {
			frappe.call({
				method: "academia.transactions.doctype.outbox_memo.outbox_memo.get_direct_reports_to_hierarchy_reverse",
				args: {
					employee_name: frm.doc.start_from,
				},
				callback: function (response) {
					mustInclude = []
					if (response.message && response.message.length > 0) {
						// Filter out null values and employees without users
						mustInclude = response.message.filter(emp => emp !== null);
					}
	
					// If mustInclude is empty, add a placeholder value
					if (mustInclude.length === 0) {
						mustInclude.push({ name: "No valid employees", employee_name: "No valid employees" });
					}
					console.log(mustInclude);

				},
			});
		}
	}
}

function add_approve_action(frm) {
	cur_frm.page.add_action_item(__("Approve"), function () {
		if (
			(frm.doc.type == "Internal" &&
				global_current_employee === frm.doc.recipients[0].recipient) ||
			(frm.doc.type == "External" && global_current_employee == frm.doc.end_employee) ||
			frm.doc.full_electronic ||
			frm.doc.direction == "Downward"
		) {
			frappe.prompt(
				[
					{
						label: "Details",
						fieldname: "details",
						fieldtype: "Text",
					},
				],
				function (values) {
					frappe.call({
						method: "academia.transactions.doctype.outbox_memo.outbox_memo.create_new_outbox_memo_action",
						args: {
							user_id: frappe.session.user,
							outbox_memo: frm.doc.name,
							type: "Approved",
							details: values.details || "",
						},
						callback: function (r) {
							if (r.message) {
								// console.log(r.message);
								if (r.message) {
									frappe.db
										.set_value(
											"Outbox Memo",
											frm.docname,
											"current_action_maker",
											r.message.action_maker
										)
										.then(() => {
											frappe.db
												.set_value(
													"Transaction New",
													frm.doc.transaction_reference,
													"transaction_holder",
													r.message.action_maker
												)
												.then(() => {
													location.reload();
												})
										});
								}
								// frappe.db.set_value('Transaction', frm.docname, 'status', 'Approved');
							}
						},
					});
				},
				__("Enter Approval Details"),
				__("Submit")
			);
		} else {
			frappe.prompt(
				[
					{
						label: "Details",
						fieldname: "details",
						fieldtype: "Text",
					},
					{
						fieldname: "document_name",
						fieldtype: "Link",
						label: "Document Name",
						options: "Transaction",
						default: frm.doc.name,
						read_only: 1,
						hidden: 1,
					},
					{
						fieldname: "start_employee",
						fieldtype: "Link",
						label: "Start From",
						options: "Employee",
						read_only: 1,
						hidden: 1,
						default: global_current_employee || "",
					},
					{
						fieldname: "end_employee",
						fieldtype: "Link",
						label: "End To",
						options: "Employee",
						default: global_next_recipient || "",
						read_only: 1,
						hidden: 1,
					},
					{
						fieldname: "through_middle_man",
						fieldtype: "Check",
						label: "Through Middle Man",
					},
					{
						fieldname: "middle_man",
						fieldtype: "Link",
						label: "Middle Man",
						options: "Employee",
						depends_on: "eval:doc.through_middle_man == 1",
						get_query: function () {
							return {
								query: "academia.transactions.doctype.outbox_memo.outbox_memo.get_middle_man_list",
							};
						},
					},
					{
						fieldname: "with_proof",
						label: __("With Proof"),
						fieldtype: "Check",
					},
					{
						fieldname: "proof",
						label: __("Proof"),
						fieldtype: "Attach",
						depends_on: "eval:doc.with_proof == 1",
					},
				],
				function (values) {
					if (values.through_middle_man && !values.middle_man) {
						frappe.msgprint({
							title: __("Error"),
							indicator: "red",
							message: __("Please select a Middle Man."),
						});
						return;
					}
					if (values.with_proof && !values.proof) {
						frappe.msgprint({
							title: __("Error"),
							indicator: "red",
							message: __("Please attach proof."),
						});
						return;
					}

					frappe.call({
						method: "academia.transactions.doctype.outbox_memo.outbox_memo.create_new_outbox_memo_action",
						args: {
							user_id: frappe.session.user,
							outbox_memo: frm.doc.name,
							type: "Approved",
							details: values.details || "",
						},
						callback: function (r) {
							if (r.message) {
								// console.log(r.message);
								if (r.message) {
									frappe.db
										.set_value(
											"Outbox Memo",
											frm.docname,
											"current_action_maker",
											r.message.action_maker
										)
										.then(() => {
											frappe.db
												.set_value(
													"Transaction New",
													frm.doc.transaction_reference,
													"transaction_holder",
													r.message.action_maker
												)
												.then(() => {
													console.log(r.message);
													global_action_name = r.message.action_name;
													console.log(global_action_name);

													frappe.call({
														method: "academia.transactions.doctype.outbox_memo.outbox_memo.create_transaction_document_log",
														args: {
															start_employee: values.start_employee,
															end_employee: global_next_recipient,
															document_type: "Outbox Memo",
															document_name: values.document_name,
															document_action_type: "Outbox Memo Action",
															document_action_name: global_action_name,
															middle_man: values.middle_man,
															through_middle_man: values.through_middle_man
																? "True"
																: "False",
															proof: values.proof,
															with_proof: values.with_proof
																? "True"
																: "False",
														},
														callback: function (r) {
															if (r.message) {
																console.log(
																	"Transaction Document Log created:",
																	r.message
																);
																if (r.message) {
																	if (
																		values.with_proof &&
																		!values.through_middle_man
																	) {
																		frappe.db
																			.set_value(
																				"Outbox Memo",
																				frm.docname,
																				"is_received",
																				1
																			)
																			.then(() => {
																				location.reload();
																			});
																	} else {
																		frappe.db
																			.set_value(
																				"Outbox Memo",
																				frm.docname,
																				"is_received",
																				0
																			)
																			.then(() => {
																				location.reload();
																			});
																	}
																	// location.reload();
																}
															}
														},
														error: function (r) {
															frappe.msgprint("You are in the error");
															console.error(r);
															frappe.msgprint({
																title: __("Error"),
																indicator: "red",
																message: r.message,
															});
														},
													});
												});
										});
								}

								// Fetch the next recipient based on the next step
								// frappe.call({
								// 	method: "academia.transaction_management.doctype.transaction.transaction.get_next_recipient_by_step",
								// 	args: {
								// 		transaction_name: values.transaction_name,
								// 		current_employee: start_employee,
								// 	},
								// 	callback: function (r) {
								// 		if (r.message) {
								// 			const end_employee = r.message;
								// 			console.log(end_employee)
								// 			// Call the server-side method to create the transaction paper log

								// 		} else {
								// 			frappe.msgprint(__("No next recipient found."));
								// 		}
								// 	},
								// 	error: function (r) {
								// 		console.error(r);
								// 	},
								// });
								// if (r.message) {
								// 	location.reload();
								// }
								// frappe.db.set_value('Transaction', frm.docname, 'status', 'Approved');
							}
						},
					});
				},
				__("Enter Approval Details"),
				__("Submit")
			);
		}
	});
}

function add_reject_action(frm) {
	cur_frm.page.add_action_item(__("Reject"), function () {
		frappe.prompt(
			[
				{
					label: "Details",
					fieldname: "details",
					fieldtype: "Text",
				},
			],
			function (values) {
				if (!values.details) {
					frappe.msgprint({
						title: __("Error"),
						indicator: "red",
						message: __("Please enter rejection details."),
					});
					return;
				}
				frappe.call({
					method: "academia.transactions.doctype.outbox_memo.outbox_memo.create_new_outbox_memo_action",
					args: {
						user_id: frappe.session.user,
						outbox_memo: frm.doc.name,
						type: "Rejected",
						details: values.details || "",
					},
					callback: function (r) {
						if (r.message) {
							location.reload();
							// frappe.db.set_value('Transaction', frm.docname, 'status', 'Rejected');
						}
					},
				});
			},
			__("Enter Rejection Details"),
			__("Submit")
		);
	});
}

function add_redirect_action(frm) {
	cur_frm.page.add_action_item(__("Redirect"), function () {
		localStorage.setItem("outbox_memo", frm.doc.name);

		const url = frappe.urllib.get_full_url(
			"/app/outbox-memo-action/new?outbox_memo=" + frm.doc.name + "&type=Redirected"
		);

		// فتح الرابط في نافذة جديدة
		window.location.href = url;
		// frappe.new_doc("Inbox Memo Action", {
		// 	inbox_memo: frm.doc.name,
		// 	type: "Redirected",
		// 	from_company: frm.doc.start_from_company,
		// 	from_department: frm.doc.start_from_department,
		// 	from_designation: frm.doc.start_from_designation,
		// 	// received: is_received,
		// });
		// // back to Transaction after save the transaction action
		// frappe.ui.form.on("Inbox Memo Action", {
		// 	on_submit: function () {
		// 		if (frm.doc.inbox_memo) { frappe.msgprint(frm.doc.inbox_memo) }
		// 		else { frappe.msgprint("")}
		// 		frappe.call({
		// 			method: "academia.transactions.doctype.inbox_memo.inbox_memo.update_share_permissions",
		// 			args: {
		// 				docname: frm.doc.name,
		// 				user: frappe.session.user,
		// 				permissions: {
		// 					read: 1,
		// 					write: 0,
		// 					share: 0,
		// 					submit: 0,
		// 				},
		// 			},
		// 			callback: function (response) {
		// 				if (response.message) {
		// 					inbox_memo_action_doc = frappe.get_doc("Inbox Memo Action", frm.doc)
		// 					// frappe.db.set_value(inbox_memo , 'current_action_maker')
		// 					frappe.db.set_value("Inbox Memo", frm.doc.inbox_memo, "current_action_maker", inbox_memo_action_doc.recipients[0].recipient_email);
		// 					// back to Transaction after save the transaction action
		// 					frappe.set_route("Form", "Inbox Memo", frm.doc.name);
		// 					location.reload();
		// 				}
		// 			},
		// 		});
		// 	},
		// });
	});
}

function update_related_actions_html(frm) {
	frappe.call({
		method: "academia.transactions.doctype.outbox_memo.outbox_memo.get_outbox_memo_actions_html",
		args: {
			outbox_memo_name: frm.doc.name,
		},
		callback: function (r) {
			if (r.message) {
				frm.set_df_property("related_actions", "options", r.message);
				frm.refresh_field("related_actions");
			}
		},
	});
}

frappe.listview_settings["Outbox Memo"] = {
	hide_add_button: true,
};
