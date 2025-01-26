# Copyright (c) 2025, SanU and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class EmployeeProxies(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from academia.transactions.doctype.delegated_employees.delegated_employees import DelegatedEmployees
		from frappe.types import DF

		delegated_employees: DF.Table[DelegatedEmployees]
		employee: DF.Link
		employee_company: DF.Link | None
		employee_department: DF.Link | None
		employee_designation: DF.Link | None
		employee_email: DF.Link
		employee_name: DF.Data | None
	# end: auto-generated types
	pass
